import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  MicrophoneIcon, 
  PaperClipIcon, 
  XMarkIcon, 
  SpeakerWaveIcon, 
  StopIcon, 
  Cog6ToothIcon, 
  ArrowPathIcon, 
  DocumentTextIcon, 
  MusicalNoteIcon, 
  PhotoIcon, 
  TrashIcon, 
  ArrowLeftIcon 
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, UploadedFile, TTSSettings } from '../types';
import { sendMessageToDify, uploadFileToDify, fetchAppParams, fetchHistory } from '../services/difyService';

interface ChatInterfaceProps {
  mode: 'research' | 'scribe';
  apiKey: string;
  onExit: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ mode, apiKey, onExit }) => {
  // -- State --
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  
  // TTS Settings
  const [ttsConfig, setTtsConfig] = useState<TTSSettings>({
    enabled: true,
    autoPlay: false,
    lang: 'en-US',
    voiceURI: null,
    rate: 1,
    pitch: 1
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // -- Effects --

  // Load App Params (Opener, Suggestions) and History
  useEffect(() => {
      const initSession = async () => {
          setIsLoading(true);
          
          // 1. Load Parameters
          try {
             const params = await fetchAppParams(apiKey);
             setSuggestedQuestions(params.suggested_questions || []);
             
             // 2. Load Local Storage Config
             const savedConvId = localStorage.getItem(`clara_conv_${mode}`);
             
             if (savedConvId) {
                 setConversationId(savedConvId);
                 // Try fetch history
                 const history = await fetchHistory(apiKey, savedConvId);
                 if (history.length > 0) {
                     setMessages(history);
                 } else {
                     // Fallback to local storage messages if API history fails/empty
                     const localMsgs = localStorage.getItem(`clara_msgs_${mode}`);
                     if (localMsgs) {
                         setMessages(JSON.parse(localMsgs));
                     }
                 }
             } else {
                 // New Session - Set Welcome Message
                 const welcomeMsg: Message = {
                    id: 'welcome',
                    role: 'assistant',
                    content: params.opening_statement || (mode === 'research' 
                        ? "Hello. I am **CLARA Research**. Ask me about medical protocols, drug interactions, or latest clinical guidelines."
                        : "System Online. I am **CLARA Scribe**. Upload patient consultation audio or start speaking to generate FHIR records."),
                    timestamp: Date.now(),
                    suggestedQuestions: params.suggested_questions
                 };
                 setMessages([welcomeMsg]);
             }
          } catch (e) {
              console.error("Init failed", e);
          } finally {
              setIsLoading(false);
          }
      };
      
      initSession();
  }, [mode, apiKey]);

  // Save Session
  useEffect(() => {
      if (conversationId) {
          localStorage.setItem(`clara_conv_${mode}`, conversationId);
      }
      if (messages.length > 0) {
          localStorage.setItem(`clara_msgs_${mode}`, JSON.stringify(messages));
      }
  }, [conversationId, messages, mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (!ttsConfig.voiceURI && availableVoices.length > 0) {
        const preferred = availableVoices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English')) || availableVoices[0];
        setTtsConfig(prev => ({ ...prev, voiceURI: preferred.voiceURI }));
      }
    };
    
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    return () => {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (ttsConfig.autoPlay && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.id !== 'welcome' && Date.now() - lastMsg.timestamp < 1000) {
        speak(lastMsg.content);
      }
    }
  }, [messages, ttsConfig.autoPlay]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // -- Handlers --
  
  const clearHistory = () => {
      localStorage.removeItem(`clara_conv_${mode}`);
      localStorage.removeItem(`clara_msgs_${mode}`);
      setMessages([]);
      setConversationId(null);
      window.location.reload();
  }

  const handleSendMessage = async (text: string = inputValue) => {
    if ((!text.trim() && files.length === 0) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      files: [...files]
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setFiles([]);
    setIsLoading(true);

    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      // Prepare files for Dify
      const difyFiles = userMsg.files?.map(f => ({
        type: f.type, 
        transfer_method: 'remote_url', // We don't have local_file logic for Dify JS SDK, treating as remote or upload ID based
        upload_file_id: f.id,
        url: f.url 
      })) || [];

      // Send to Dify
      // Increase timeout for Scribe mode (360s), default for Research (300s)
      const requestTimeout = mode === 'scribe' ? 360000 : 300000;
      
      const response = await sendMessageToDify(apiKey, text, conversationId, difyFiles as any, requestTimeout);
      
      setConversationId(response.conversation_id);

      const botMsg: Message = {
        id: response.id || Date.now().toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: Date.now(),
        suggestedQuestions: []
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `Error: ${error.message || "Could not reach Neural Core."} Please retry.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      let fileType: UploadedFile['type'] = 'document';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type.startsWith('audio/')) fileType = 'audio';
      else if (file.type.startsWith('video/')) fileType = 'video';

      const tempId = Date.now().toString();
      const tempUrl = URL.createObjectURL(file);

      setFiles(prev => [...prev, {
        id: tempId,
        name: file.name,
        type: fileType,
        mimeType: file.type,
        url: tempUrl
      }]);

      try {
        const userId = localStorage.getItem('clara_user_id') || 'user_1';
        const uploadRes = await uploadFileToDify(apiKey, file, userId);
        
        // Update file with actual ID from Dify
        setFiles(prev => prev.map(f => f.id === tempId ? { ...f, id: uploadRes.id } : f));
      } catch (err) {
        console.error("Upload failed", err);
        setFiles(prev => prev.filter(f => f.id !== tempId)); // Remove on fail
        alert("Failed to upload file to secure server.");
      }
    }
  };

  // STT Handler
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Speech recognition not supported in this browser.");
        return;
      }
      
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = ttsConfig.lang;

      recognitionRef.current.onstart = () => setIsRecording(true);
      recognitionRef.current.onend = () => setIsRecording(false);
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
      };

      recognitionRef.current.start();
    }
  };

  // TTS Handler
  const speak = (text: string) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (!ttsConfig.enabled) return;

    // Remove markdown symbols for speech
    const cleanText = text
        .replace(/[*#`_~>\[\]\(\)]/g, '')
        .replace(/https?:\/\/\S+/g, 'link');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = voices.find(v => v.voiceURI === ttsConfig.voiceURI) || null;
    utterance.rate = ttsConfig.rate;
    utterance.pitch = ttsConfig.pitch;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // -- Render Helpers --

  const handleSuggestionClick = (suggestion: string) => {
     handleSendMessage(suggestion);
  };

  const renderMessageContent = (content: string) => {
     // Pre-process custom variables like {{variable}}
     const processed = content.replace(/\{\{(.*?)\}\}/g, '**$1**');
     
     return (
       <div className="prose prose-invert prose-sm md:prose-base max-w-none break-words">
         <ReactMarkdown 
           remarkPlugins={[remarkGfm]}
           components={{
               // Custom Table rendering for horizontal scroll on mobile
               table: ({node, ...props}) => (
                 <div className="overflow-x-auto my-4 rounded-lg border border-slate-700/50 bg-slate-900/30">
                   <table className="w-full text-left border-collapse min-w-[500px] md:min-w-full" {...props} />
                 </div>
               ),
               // Ensure links open in new tab
               a: ({node, ...props}) => (
                 <a target="_blank" rel="noopener noreferrer" {...props} />
               ),
               // Custom Code rendering
               code: ({node, className, children, ...props}) => {
                 const match = /language-(\w+)/.exec(className || '');
                 const isInline = !match && !String(children).includes('\n');
                 return isInline ? (
                   <code className={className} {...props}>
                     {children}
                   </code>
                 ) : (
                   <code className={className} {...props}>
                      {children}
                   </code>
                 );
               }
           }}
         >
           {processed}
         </ReactMarkdown>
       </div>
     );
  };

  const renderFilePreview = (f: UploadedFile, isUploadPreview: boolean = false) => {
      return (
          <div key={f.id} className={`relative group ${isUploadPreview ? 'w-16 h-16 md:w-20 md:h-20 flex-shrink-0' : 'w-full max-w-[200px] mb-2'}`}>
            <div className={`rounded bg-slate-900 border border-slate-700 overflow-hidden flex flex-col items-center justify-center ${isUploadPreview ? 'h-full' : 'p-2'}`}>
              
              {f.type === 'image' && (
                  <img src={f.url} alt={f.name} className={`${isUploadPreview ? 'w-full h-full object-cover' : 'max-h-64 object-contain'}`} />
              )}
              
              {f.type === 'audio' && (
                  <div className="flex flex-col items-center gap-2 p-2 w-full">
                      <MusicalNoteIcon className="w-8 h-8 text-cyan-500" />
                      {!isUploadPreview && <audio controls src={f.url} className="w-full h-8" />}
                      <span className="text-xs text-slate-400 truncate w-full text-center">{f.name}</span>
                  </div>
              )}

              {f.type === 'document' && (
                  <div className="flex flex-col items-center gap-1 p-2">
                       <DocumentTextIcon className="w-8 h-8 text-slate-500"/>
                       <span className="text-xs text-slate-400 truncate w-full text-center">{f.name}</span>
                  </div>
              )}
              
               {f.type === 'video' && (
                  <div className="flex flex-col items-center gap-1 p-2">
                       <DocumentTextIcon className="w-8 h-8 text-purple-500"/>
                       <span className="text-xs text-slate-400 truncate w-full text-center">{f.name}</span>
                  </div>
              )}
            </div>
            
            {isUploadPreview && (
                <button 
                onClick={() => setFiles(files.filter(file => file.id !== f.id))}
                className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white shadow-sm hover:scale-110 transition-transform"
                >
                <XMarkIcon className="w-3 h-3" />
                </button>
            )}
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden">
      
      {/* Sidebar / Settings Drawer */}
      <div 
        className={`
          fixed inset-y-0 right-0 w-80 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700 
          transform transition-transform duration-300 z-50 shadow-2xl
          ${showSettings ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
             <h2 className="font-display font-bold text-xl text-white">SYSTEM CONFIG</h2>
             <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-full transition-colors">
               <XMarkIcon className="w-6 h-6" />
             </button>
          </div>

          <div className="space-y-8 flex-1 overflow-y-auto pr-2">
            <div className="space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-cyan-500 flex items-center gap-2">
                <SpeakerWaveIcon className="w-4 h-4" /> Voice Synthesis
              </h3>
              
              <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                <span className="text-sm font-medium">Enable TTS</span>
                <button 
                   onClick={() => setTtsConfig(p => ({...p, enabled: !p.enabled}))}
                   className={`w-11 h-6 rounded-full transition-colors relative ${ttsConfig.enabled ? 'bg-cyan-600' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${ttsConfig.enabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                 <span className="text-sm font-medium">Auto Play</span>
                 <button 
                   onClick={() => setTtsConfig(p => ({...p, autoPlay: !p.autoPlay}))}
                   className={`w-11 h-6 rounded-full transition-colors relative ${ttsConfig.autoPlay ? 'bg-cyan-600' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${ttsConfig.autoPlay ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

               <div className="space-y-2">
                <label className="text-xs text-slate-400 uppercase font-mono">Voice Model</label>
                <select 
                  value={ttsConfig.voiceURI || ''}
                  onChange={(e) => setTtsConfig(p => ({...p, voiceURI: e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2.5 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                >
                  {voices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
                 <button 
                   onClick={clearHistory} 
                   className="w-full py-3 bg-red-900/10 text-red-400 hover:bg-red-900/20 border border-red-900/30 rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-medium hover:border-red-900/50"
                 >
                     <TrashIcon className="w-4 h-4" /> Clear Session History
                 </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for settings */}
      {showSettings && (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowSettings(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full h-full relative shadow-2xl shadow-black/50">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-slate-800/50 bg-[#020617]/90 backdrop-blur sticky top-0 z-30">
          <div className="flex items-center gap-3">
             <button onClick={onExit} className="p-2 -ml-2 hover:bg-slate-800 rounded-full transition-colors group" title="Back to Home">
                <ArrowLeftIcon className="w-5 h-5 text-slate-400 group-hover:text-white" />
             </button>
             <div>
               <h1 className="font-display font-bold text-white text-base md:text-lg tracking-wide leading-none">
                 {mode === 'research' ? 'CLARA RESEARCH' : 'CLARA SCRIBE'}
               </h1>
               <div className="flex items-center gap-2 text-[10px] md:text-xs font-mono text-cyan-500 mt-1">
                 <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-cyan-400 animate-ping' : 'bg-cyan-500'}`}/>
                 {isLoading ? 'NEURAL PROCESSING...' : 'SYSTEM ONLINE'}
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2">
             {isSpeaking && (
                <button onClick={stopSpeaking} className="p-2 text-red-400 hover:bg-red-950/30 rounded-full animate-pulse mr-2" title="Stop Speaking">
                  <StopIcon className="w-5 h-5" />
                </button>
             )}
             <button 
               onClick={() => setShowSettings(true)}
               className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-cyan-400 transition-colors"
             >
               <Cog6ToothIcon className="w-5 h-5" />
             </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">
          {messages.length === 0 && isLoading && (
              <div className="flex flex-col justify-center items-center h-full text-slate-500 space-y-4">
                  <div className="relative">
                     <div className="w-12 h-12 border-4 border-slate-800 rounded-full"></div>
                     <div className="w-12 h-12 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                  </div>
                  <p className="font-mono text-xs tracking-widest animate-pulse">ESTABLISHING UPLINK</p>
              </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] md:max-w-[75%] lg:max-w-[70%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                
                {/* Message Bubble */}
                <div 
                  className={`
                    p-4 md:p-5 rounded-2xl relative group w-full shadow-lg
                    ${msg.role === 'user' 
                      ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-tr-sm shadow-cyan-900/20' 
                      : 'bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 text-slate-200 rounded-tl-sm'}
                  `}
                >
                  {msg.files && msg.files.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {msg.files.map((f, i) => renderFilePreview(f))}
                    </div>
                  )}
                  
                  <div className="text-sm md:text-base leading-relaxed">
                    {msg.role === 'system' 
                      ? <span className="text-red-400 font-mono text-xs border border-red-900/50 bg-red-900/10 px-2 py-1 rounded inline-block">{msg.content}</span>
                      : renderMessageContent(msg.content)
                    }
                  </div>

                  {/* TTS Button for Assistant Messages */}
                  {msg.role === 'assistant' && (
                    <button 
                      onClick={() => speak(msg.content)}
                      className="absolute -bottom-8 left-0 text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                      title="Read Aloud"
                    >
                      <SpeakerWaveIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Suggested Questions (only on last assistant message) */}
                {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
                    {msg.suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(q)}
                        className="text-xs border border-cyan-800/40 bg-cyan-950/30 text-cyan-300 px-3 py-2 rounded-lg hover:bg-cyan-900/50 hover:border-cyan-700 transition-all flex items-center gap-1.5"
                      >
                         <ArrowPathIcon className="w-3 h-3 opacity-70" /> {q}
                      </button>
                    ))}
                  </div>
                )}
                
                <span className="text-[10px] text-slate-600 mt-1 font-mono px-1 select-none">
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          ))}

          {/* Fallback suggestions if history loaded without them or empty state */}
          {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && suggestedQuestions.length > 0 && !messages[messages.length-1].suggestedQuestions?.length && (
               <div className="flex flex-wrap gap-2 pl-2">
               {suggestedQuestions.map((q, idx) => (
                 <button
                   key={`global-${idx}`}
                   onClick={() => handleSuggestionClick(q)}
                   className="text-xs border border-cyan-800/40 bg-cyan-950/30 text-cyan-300 px-3 py-2 rounded-lg hover:bg-cyan-900/50 hover:border-cyan-700 transition-all flex items-center gap-1.5"
                 >
                    <ArrowPathIcon className="w-3 h-3 opacity-70" /> {q}
                 </button>
               ))}
             </div>
          )}
          
          {isLoading && (
             <div className="flex justify-start animate-pulse">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                   <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                   <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                   <span className="text-xs font-mono text-cyan-500 ml-2 tracking-widest">ANALYZING</span>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-4"/>
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-6 bg-[#020617] relative z-20">
          <div className="glass-panel rounded-2xl p-2 flex flex-col gap-2 relative shadow-lg shadow-cyan-900/5 border-slate-700/50 transition-all focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20">
            
            {/* File Preview in Input */}
            {files.length > 0 && (
              <div className="flex gap-2 px-2 pt-2 overflow-x-auto pb-2 scrollbar-hide">
                {files.map((f) => renderFilePreview(f, true))}
              </div>
            )}

            <div className="flex items-end gap-2">
               {/* Upload Button */}
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="p-3 text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 rounded-xl transition-colors flex-shrink-0"
                 title="Upload File"
               >
                 <PaperClipIcon className="w-5 h-5" />
               </button>
               <input 
                 type="file" 
                 multiple 
                 accept="image/*,application/pdf,audio/*,text/plain"
                 className="hidden" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload}
               />

               {/* Text Area */}
               <textarea
                 ref={textareaRef}
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     handleSendMessage();
                   }
                 }}
                 placeholder={mode === 'research' ? "Ask about medical protocols..." : "Type clinical notes..."}
                 className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none py-3 max-h-32 min-h-[48px] scrollbar-hide text-sm md:text-base leading-relaxed"
                 rows={1}
               />
               
               {/* STT Button */}
               <button 
                 onClick={toggleRecording}
                 className={`p-3 rounded-xl transition-all flex-shrink-0 ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50'}`}
                 title="Voice Input"
               >
                 <MicrophoneIcon className="w-5 h-5" />
               </button>

               {/* Send Button */}
               <button 
                 onClick={() => handleSendMessage()}
                 disabled={(!inputValue.trim() && files.length === 0) || isLoading}
                 className="p-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20 active:scale-95 flex-shrink-0"
               >
                 <PaperAirplaneIcon className="w-5 h-5" />
               </button>
            </div>
          </div>
          <div className="text-center mt-3">
            <p className="text-[10px] text-slate-600 font-mono">
               CLARA AI v1.0 • HIPAA Compliant Engine • Verified Evidence Only
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChatInterface;