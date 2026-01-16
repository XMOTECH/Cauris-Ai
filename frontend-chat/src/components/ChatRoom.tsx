import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  LogOut,
  Menu,
  X,
  Plus,
  Search,
  MessageSquare,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  SendHorizontal,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { CaurisIcon } from './CaurisIcon';
import { chatApi, documentApi } from '../services/api';

// Hook pour le mode sombre (Simplified for EXECUTION)
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return [isDark, setIsDark] as const;
};

// Type pour nos messages
interface IMessage {
  message: string;
  sender: "user" | "bot";
  direction: "outgoing" | "incoming";
  timestamp: string;
}

const ChatRoom = () => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<IMessage[]>([
    {
      message: "Bonjour ! Je suis Cauris AI, votre assistant académique intelligent. Comment puis-je vous accompagner dans vos travaux aujourd'hui ?",
      sender: "bot",
      direction: "incoming",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [history, setHistory] = useState<any[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [isTyping, setIsTyping] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Fetch History
  const fetchHistory = async () => {
    try {
      const response = await chatApi.getHistory();
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  // Connexion au WebSocket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    fetchHistory();

    const connectWebSocket = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      setWsStatus('connecting');
      const wsUrl = `ws://${window.location.hostname}:8000/api/v1/chat/ws?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("🟢 Connecté");
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        const botResponse = event.data;
        setIsTyping(false);

        setMessages((prev) => [
          ...prev,
          {
            message: botResponse.replace(/^ : /, ""),
            sender: "bot",
            direction: "incoming",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        fetchHistory();
      };

      ws.onerror = () => {
        setWsStatus('error');
        setIsTyping(false);
      };

      ws.onclose = () => {
        console.log("🔴 Déconnecté");
        setWsStatus('disconnected');
        reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, 3000);
      };

      socketRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [navigate]);

  const handleSend = () => {
    if (!inputValue.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const newMessage: IMessage = {
      message: inputValue,
      sender: "user",
      direction: "outgoing",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setIsTyping(true);
    socketRef.current.send(inputValue);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadingFile(file);
      setUploadStatus('uploading');
      try {
        await documentApi.upload(file);
        setUploadStatus('success');
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadStatus('idle');
          setUploadingFile(null);
        }, 2000);
      } catch (err) {
        console.error("Upload failed:", err);
        setUploadStatus('error');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden font-['Outfit']">

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="relative h-full bg-[#121214] border-r border-white/5 flex flex-col z-50 overflow-hidden"
      >
        <div className="p-6 flex flex-col h-full min-w-[320px]">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)]">
              <CaurisIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Cauris <span className="text-indigo-400">AI</span></h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setMessages([{
                message: "Discussion réinitialisée. Comment puis-je vous aider ?",
                sender: "bot",
                direction: "incoming",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]);
            }}
            className="flex items-center gap-2 w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-medium mb-8 group"
          >
            <Plus className="w-4 h-4 text-indigo-400 group-hover:rotate-90 transition-transform" />
            Nouvelle discussion
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 px-2 font-semibold">Historique</p>
            {history.length > 0 ? (
              history.slice().reverse().map((item, i) => (
                <button
                  type="button"
                  key={i}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 transition-all group text-left"
                  onClick={() => {
                    const welcomeMsg = messages[0];
                    setMessages([
                      welcomeMsg,
                      { message: item.question, sender: "user", direction: "outgoing", timestamp: "" },
                      { message: item.answer, sender: "bot", direction: "incoming", timestamp: "" }
                    ]);
                  }}
                >
                  <MessageSquare className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 flex-shrink-0" />
                  <span className="text-sm text-gray-400 group-hover:text-white truncate">{item.question}</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-600 px-3 italic">Aucun historique</p>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-white/5 space-y-2">
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 transition-all text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              <Upload className="w-5 h-5" />
              Entraîner avec un PDF
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-500/10 transition-all text-red-400 text-sm"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">

        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-6 bg-[#09090b]/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/5 transition-all text-gray-400"
            >
              {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </button>
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                Assistant Cauris
                <div className={`w-2 h-2 rounded-full animate-pulse ${wsStatus === 'connected' ? 'bg-emerald-500' :
                  wsStatus === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
              </h2>
              <p className="text-xs text-gray-400 font-medium italic">
                {wsStatus === 'connected' ? 'Base de connaissance active' :
                  wsStatus === 'connecting' ? 'Connexion en cours...' : 'Déconnecté du serveur'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <p className="text-sm font-medium">{localStorage.getItem('user_email')}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Utilisateur</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
        </header>

        {/* Message Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth"
        >
          <div className="max-w-4xl mx-auto space-y-8 pb-32">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-4 max-w-[85%] md:max-w-[75%] ${msg.direction === 'outgoing' ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-1
                      ${msg.direction === 'outgoing' ? 'bg-indigo-600 shadow-indigo-600/20' : 'bg-white/5 border border-white/10 shadow-lg shadow-black/20'}`}>
                      {msg.direction === 'outgoing' ? <User className="w-5 h-5 text-white" /> : <CaurisIcon className="w-5 h-5 text-indigo-400" />}
                    </div>

                    <div className="space-y-1">
                      <div className={`px-5 py-3.5 rounded-2xl text-[0.95rem] leading-relaxed shadow-lg
                        ${msg.direction === 'outgoing'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-[#1a1a1e] border border-white/5 text-gray-200 rounded-tl-none'}`}>
                        {msg.message}
                      </div>
                      {msg.timestamp && (
                        <p className={`text-[10px] text-gray-600 font-medium px-1 ${msg.direction === 'outgoing' ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mt-1">
                      <CaurisIcon className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="bg-[#1a1a1e] px-4 py-3 rounded-2xl rounded-tl-none border border-white/5 flex gap-1.5 items-center shadow-lg">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-8 bg-gradient-to-t from-[#09090b] via-[#09090b]/90 to-transparent pt-20">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-500" />

            <div className="relative flex items-center bg-[#1a1a1e] border border-white/10 rounded-2xl p-2 pl-4 shadow-2xl">
              <input
                type="text"
                aria-label="Message input"
                placeholder="Posez n'importe quelle question sur vos cours..."
                className="flex-1 bg-transparent border-none outline-none text-sm py-3 px-2 placeholder-gray-500 text-white font-light"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                type="button"
                aria-label="Send message"
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-gray-800 rounded-xl transition-all shadow-lg text-white"
              >
                <SendHorizontal className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-600 mt-4 uppercase tracking-[0.3em] font-semibold">
              Cauris AI peut faire des erreurs. Vérifiez les informations importantes.
            </p>
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-morphism w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-400" />
                  Entraîner Cauris AI
                </h3>
                <button
                  type="button"
                  aria-label="Close upload modal"
                  onClick={() => !uploadingFile && setShowUploadModal(false)}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <p className="text-sm text-gray-400 leading-relaxed">
                  Ajoutez vos supports de cours (PDF) pour permettre à l'IA de répondre à vos questions spécifiques sur ces documents.
                </p>

                <div
                  onClick={() => uploadStatus === 'idle' && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer
                    ${uploadStatus === 'idle' ? 'border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5' : 'border-indigo-500/30'}`}
                >
                  <input
                    type="file"
                    aria-label="Select PDF file"
                    title="Select PDF file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                  />

                  {uploadStatus === 'idle' && (
                    <>
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-300">Cliquez pour choisir un PDF</p>
                    </>
                  )}

                  {uploadStatus === 'uploading' && (
                    <>
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                      <p className="text-sm font-medium text-indigo-400">Indexation en cours...</p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{uploadingFile?.name}</p>
                    </>
                  )}

                  {uploadStatus === 'success' && (
                    <>
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-400">Document indexé !</p>
                      <p className="text-xs text-gray-500">Cauris AI est prêt à en discuter.</p>
                    </>
                  )}

                  {uploadStatus === 'error' && (
                    <>
                      <X className="w-10 h-10 text-red-500" />
                      <p className="text-sm font-medium text-red-400">Échec du traitement</p>
                      <p className="text-xs text-gray-500">Veuillez réessayer avec un autre fichier.</p>
                    </>
                  )}
                </div>

                <div className="flex gap-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold items-center justify-center">
                  <ShieldCheck className="w-3 h-3" />
                  Privé & Sécurisé
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatRoom;
