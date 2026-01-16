class User {
  final String email;
  final String token;

  User({required this.email, required this.token});

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      email: json['email'] ?? '', // Adapte selon ce que ton API renvoie
      token: json['access_token'],
    );
  }
}
