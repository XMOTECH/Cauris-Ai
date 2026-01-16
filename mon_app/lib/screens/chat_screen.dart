import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:animate_do/animate_do.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:dio/dio.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:file_picker/file_picker.dart';
import '../services/auth_service.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  WebSocketChannel? _channel;
  final List<Map<String, dynamic>> _messages = [];
  bool _isTyping = false;
  List<dynamic> _history = [];

  @override
  void initState() {
    super.initState();
    _connectWebSocket();
    _loadHistory();
    // Default welcome message
    _messages.add({
      "text": "Bonjour ! Je suis Cauris AI, votre assistant académique. Comment puis-je vous aider aujourd'hui ?",
      "isBot": true,
      "time": _formatTime(DateTime.now()),
    });
  }

  void _connectWebSocket() {
    final auth = Provider.of<AuthService>(context, listen: false);
    final token = auth.token;
    if (token == null) return;

    // Harmonisation de l'URL pour le WebSocket
    final wsUrl = auth.baseUrl.replaceFirst('http', 'ws') + '/chat/ws?token=$token';
    _channel = WebSocketChannel.connect(Uri.parse(wsUrl));

    _channel!.stream.listen((data) {
      if (mounted) {
        setState(() {
          _isTyping = false;
          _messages.add({
            "text": data.toString().replaceFirst(' : ', ''),
            "isBot": true,
            "time": _formatTime(DateTime.now()),
          });
        });
        _scrollToBottom();
        _loadHistory(); // Refresh history
      }
    }, onError: (err) {
      debugPrint("WS Error: $err");
    });
  }

  Future<void> _loadHistory() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final dio = Dio();
      final response = await dio.get(
        '${auth.baseUrl}/chat/history',
        options: Options(headers: {'Authorization': 'Bearer ${auth.token}'}),
      );
      if (mounted) {
        setState(() {
          _history = response.data;
        });
      }
    } catch (e) {
      debugPrint("History error: $e");
    }
  }

  void _sendMessage() {
    if (_controller.text.trim().isEmpty) return;

    final text = _controller.text;
    _channel?.sink.add(text);

    setState(() {
      _messages.add({
        "text": text,
        "isBot": false,
        "time": _formatTime(DateTime.now()),
      });
      _isTyping = true;
      _controller.clear();
    });
    _scrollToBottom();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _formatTime(DateTime now) {
    return "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";
  }

  Future<void> _pickAndUploadFile() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
    );

    if (result != null) {
      final fileBytes = result.files.first.bytes;
      final fileName = result.files.first.name;

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => const Center(child: SpinKitPulse(color: Color(0xFF6366F1))),
        );
      }

      try {
        final dio = Dio();
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(fileBytes!, filename: fileName),
        });

        await dio.post(
          '${auth.baseUrl}/documents/upload',
          data: formData,
          options: Options(headers: {'Authorization': 'Bearer ${auth.token}'}),
        );

        if (mounted) {
          Navigator.pop(context); // Close loading
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Document '$fileName' envoyé pour indexation !"),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          Navigator.pop(context); // Close loading
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Échec de l'upload du document"), backgroundColor: Colors.redAccent),
          );
        }
        debugPrint("Upload error: $e");
      }
    }
  }

  @override
  void dispose() {
    _channel?.sink.close();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    
    return Scaffold(
      drawer: _buildDrawer(),
      appBar: AppBar(
        backgroundColor: const Color(0xFF09090B).withOpacity(0.8),
        elevation: 0,
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Assistant Cauris", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Row(
              children: [
                Container(width: 6, height: 6, decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle)),
                const SizedBox(width: 6),
                const Text("En ligne", style: TextStyle(fontSize: 10, color: Colors.green, fontWeight: FontWeight.w500)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Iconsax.logout_1_copy, size: 20),
            onPressed: () => auth.logout(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return _buildMessageBubble(msg);
              },
            ),
          ),
          if (_isTyping) _buildTypingIndicator(),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildDrawer() {
    return Drawer(
      backgroundColor: const Color(0xFF121214),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFFA855F7)]),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [BoxShadow(color: const Color(0xFF6366F1).withOpacity(0.3), blurRadius: 10)]
                    ),
                    child: const Icon(Iconsax.flash_1_copy, size: 24, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  const Text("Cauris AI", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const Divider(color: Colors.white10),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  const SizedBox(height: 12),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Text("HISTORIQUE", style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                  ),
                  if (_history.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(12.0),
                      child: Text("Aucun historique", style: TextStyle(fontSize: 12, color: Colors.white24, fontStyle: FontStyle.italic)),
                    ),
                  ..._history.reversed.map((item) => ListTile(
                    leading: const Icon(Iconsax.message_2_copy, size: 18, color: Colors.grey),
                    title: Text(item['question'] ?? "", style: const TextStyle(fontSize: 13, color: Colors.white70), maxLines: 1, overflow: TextOverflow.ellipsis),
                    onTap: () {},
                  )),
                ],
              ),
            ),
            const Divider(color: Colors.white10),
            ListTile(
              leading: const Icon(Iconsax.document_upload_copy, size: 20, color: Color(0xFF6366F1)),
              title: const Text("Entraîner avec un PDF", style: TextStyle(fontSize: 14, color: Color(0xFF6366F1), fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(context);
                _pickAndUploadFile();
              },
            ),
            ListTile(
              leading: const Icon(Iconsax.setting_2_copy, size: 20),
              title: const Text("Paramètres", style: TextStyle(fontSize: 14)),
              onTap: () {},
            ),
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Text(
                Provider.of<AuthService>(context).email ?? "", 
                style: const TextStyle(fontSize: 12, color: Colors.white30)
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(Map<String, dynamic> msg) {
    bool isBot = msg['isBot'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: FadeInUp(
        duration: const Duration(milliseconds: 400),
        child: Row(
          mainAxisAlignment: isBot ? MainAxisAlignment.start : MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isBot) ...[
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), border: Border.all(color: Colors.white12), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Iconsax.box_1_copy, size: 16, color: Color(0xFF6366F1)),
              ),
              const SizedBox(width: 12),
            ],
            Flexible(
              child: Column(
                crossAxisAlignment: isBot ? CrossAxisAlignment.start : CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: isBot ? const Color(0xFF1A1A1E) : const Color(0xFF6366F1),
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(20),
                        topRight: const Radius.circular(20),
                        bottomLeft: Radius.circular(isBot ? 4 : 20),
                        bottomRight: Radius.circular(isBot ? 20 : 4),
                      ),
                      border: isBot ? Border.all(color: Colors.white.withOpacity(0.05)) : null,
                      boxShadow: isBot ? null : [BoxShadow(color: const Color(0xFF6366F1).withOpacity(0.2), blurRadius: 10, offset: const Offset(0, 4))],
                    ),
                    child: Text(
                      msg['text'],
                      style: TextStyle(color: isBot ? const Color(0xFFE2E2E2) : Colors.white, fontSize: 14, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(msg['time'], style: const TextStyle(fontSize: 9, color: Colors.grey)),
                ],
              ),
            ),
            if (!isBot) ...[
              const SizedBox(width: 12),
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(color: const Color(0xFF6366F1), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Iconsax.user_copy, size: 16, color: Colors.white),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.only(left: 16, bottom: 20),
      child: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Iconsax.box_1_copy, size: 16, color: Color(0xFF6366F1)),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(color: const Color(0xFF1A1A1E), borderRadius: BorderRadius.circular(16)),
            child: const SpinKitThreeBounce(color: Color(0xFF6366F1), size: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, const Color(0xFF09090B).withOpacity(0.9)],
        ),
      ),
      child: FadeInUp(
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1E),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white10),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 20, offset: const Offset(0, 10))],
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  onSubmitted: (_) => _sendMessage(),
                  style: const TextStyle(fontSize: 14),
                  decoration: const InputDecoration(
                    hintText: "Écrire un message...",
                    hintStyle: TextStyle(color: Colors.grey, fontSize: 13),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 16),
                  ),
                ),
              ),
              ElevatedButton(
                onPressed: _sendMessage,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(44, 44),
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: const Icon(Iconsax.send_1_copy, size: 20),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
