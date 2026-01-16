import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/material.dart';

class AuthService extends ChangeNotifier {
  // ⚠️ IMPORTANT : Ton IP Wi-Fi actuelle (depuis ipconfig) est 10.157.16.172
  final String baseUrl = 'http://10.0.2.2:8000/api/v1';

  final Dio _dio = Dio();
  final _storage = const FlutterSecureStorage();

  String? _token;
  String? _email;
  bool get isAuthenticated => _token != null;
  String? get token => _token;
  String? get email => _email;

  // Vérifier si un token existe au démarrage
  Future<void> tryAutoLogin() async {
    final storedToken = await _storage.read(key: 'jwt_token');
    _email = await _storage.read(key: 'user_email');
    if (storedToken != null) {
      _token = storedToken;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    try {
      final response = await _dio.post(
        '$baseUrl/auth/login',
        data: FormData.fromMap({'username': email, 'password': password}),
      );

      if (response.statusCode == 200) {
        _token = response.data['access_token'];
        _email = email;
        await _storage.write(key: 'jwt_token', value: _token);
        await _storage.write(key: 'user_email', value: email);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint("Erreur Login: $e");
      return false;
    }
  }

  Future<bool> signup(String email, String password, String fullName) async {
    try {
      final response = await _dio.post(
        '$baseUrl/auth/signup',
        data: {
          'email': email,
          'password': password,
          'full_name': fullName,
          'role': 'student',
        },
      );

      if (response.statusCode == 200) {
        return true;
      }
      return false;
    } catch (e) {
      debugPrint("Erreur Signup: $e");
      return false;
    }
  }

  Future<void> logout() async {
    _token = null;
    _email = null;
    await _storage.delete(key: 'jwt_token');
    await _storage.delete(key: 'user_email');
    notifyListeners();
  }
}
