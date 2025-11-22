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
  ArrowLeftIcon,
  CpuChipIcon,
  HandThumbUpIcon,
  HandThumbDownIcon
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, UploadedFile, TTSSettings } from '../types';
import { sendMessageToDify, uploadFileToDify, fetchAppParams, fetchHistory, sendMessageFeedback } from '../services/difyService';

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
  const [loadingText, setLoadingText] = useState('PROCESSING');
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
          setLoadingText("INITIALIZING SYSTEMS...");
          
          try {
             const params = await fetchAppParams(apiKey);
             setSuggestedQuestions(params.suggested_questions || []);
             
             const savedConvId = localStorage.getItem(`clara_conv_${mode}`);
             
             if (savedConvId) {
                 setConversationId(savedConvId);
                 const history = await fetchHistory(apiKey, savedConvId);
                 if (history.length > 0) {
                     setMessages(history);
                 } else {
                     const localMsgs = localStorage.getItem(`clara_msgs_${mode}`);
                     if (localMsgs) {
                         setMessages(JSON.parse(localMsgs));
                     }
                 }
             } else {
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

  useEffect(() => {
      if (conversationId) {
          localStorage.setItem(`clara_conv_${mode}`, conversationId);
      }
      if (messages.length > 0) {
          localStorage.setItem(`clara_msgs_${mode}`, JSON.stringify(messages));
      }
  }, [conversationId, messages, mode]);

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    scrollToBottom();
    const timeout = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timeout);
  }, [messages, isLoading, loadingText]);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      const researchSteps = [
        "ESTABLISHING SECURE UPLINK...",
        "PARSING CLINICAL CONTEXT...",
        "RETRIEVING MEDICAL LITERATURE...",
        "ANALYZING CLINICAL TRIALS...",
        "CROSS-REFERENCING PROTOCOLS...",
        "SYNTHESIZING CITATIONS...",
        "GENERATING EVIDENCE SUMMARY..."
      ];
      const scribeSteps = [
        "UPLOADING AUDIO STREAM...",
        "ANALYZING SPECTROGRAM...",
        "RECOGNIZING SPEECH PATTERNS...",
        "IDENTIFYING CLINICAL ENTITIES...",
        "REDACTING PII...",
        "MAPPING TO SNOMED CT...",
        "STRUCTURING FHIR RECORD..."
      ];
      const steps = mode === 'research' ? researchSteps : scribeSteps;
      let i = 0;
      setLoadingText(steps[0]);
      interval = setInterval(() => {
        i = (i + 1) % steps.length;
        setLoadingText(steps[i]);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isLoading, mode]);

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
    return () => { window.speechSynthesis.cancel(); }
  }, []);

  useEffect(() => {
    if (ttsConfig.autoPlay && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.id !== 'welcome' && Date.now() - lastMsg.timestamp < 1000) {
        speak(lastMsg.content);
      }
    }
  }, [messages, ttsConfig.autoPlay]);

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
    if (files.some(f => f.isUploading)) return;
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

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const difyFiles = userMsg.files?.map(f => ({
        type: f.type, 
        transfer_method: 'remote_url', 
        upload_file_id: f.id,
        url: f.url 
      })) || [];

      const requestTimeout = mode === 'scribe' ? 1200000 : 900000;
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
        id: tempId, name: file.name, type: fileType, mimeType: file.type, url: tempUrl, isUploading: true
      }]);

      try {
        const userId = localStorage.getItem('clara_user_id') || 'user_1';
        const uploadRes = await uploadFileToDify(apiKey, file, userId);
        setFiles(prev => prev.map(f => f.id === tempId ? { ...f, id: uploadRes.id, isUploading: false } : f));
      } catch (err) {
        console.error("Upload failed", err);
        setFiles(prev => prev.filter(f => f.id !== tempId));
        alert("Failed to upload file to secure server.");
      }
    }
  };

  const handleFeedback = async (messageId: string, rating: 'like' | 'dislike') => {
      // Optimistic Update
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: rating } : m));
      
      try {
          const userId = localStorage.getItem('clara_user_id') || 'user_1';
          // Only attempt API call if it looks like a real Dify ID (uuid-ish) and not a local 'welcome'
          if (messageId !== 'welcome' && !messageId.startsWith('error_')) {
              await sendMessageFeedback(apiKey, messageId, rating, userId);
          }
      } catch (e) {
          console.error("Feedback failed", e);
      }
  };

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

  const speak = (text: string) => {
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    if (!ttsConfig.enabled) return;
    const cleanText = text.replace(/[*#`_~>\[\]\(\)]/g, '').replace(/https?:\/\/\S+/g, 'link');
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

  const handleSuggestionClick = (suggestion: string) => {
     handleSendMessage(suggestion);
  };

  const renderMessageContent = (content: string) => {
     const processed = content.replace(/\{\{(.*?)\}\}/g, '**$1**');
     return (
       <div className="prose prose-invert prose-sm md:prose-base max-w-none break-words">
         <ReactMarkdown 
           remarkPlugins={[remarkGfm]}
           components={{
               table: ({node, ...props}) => (
                 <div className="overflow-x-auto my-4 rounded border border-slate-700/50 bg-slate-900/50">
                   <table className="w-full text-left border-collapse min-w-[500px]" {...props} />
                 </div>
               ),
               a: ({node, ...props}) => (<a target="_blank" rel="noopener noreferrer" {...props} />),
               code: ({node, className, children, ...props}) => {
                 const match = /language-(\w+)/.exec(className || '');
                 const isInline = !match && !String(children).includes('\n');
                 return isInline ? <code className={className} {...props}>{children}</code> : <code className={className} {...props}>{children}</code>;
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
          <div key={f.id} className={`relative group ${isUploadPreview ? 'w-16 h-16 flex-shrink-0' : 'w-full max-w-[200px] mb-2'}`}>
            <div className={`rounded bg-slate-900 border border-slate-700 overflow-hidden flex flex-col items-center justify-center ${isUploadPreview ? 'h-full' : 'p-3'}`}>
              {f.isUploading && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                  <ArrowPathIcon className="w-4 h-4 text-cyan-400 animate-spin mb-1" />
                </div>
              )}
              {f.type === 'image' && <img src={f.url} alt={f.name} className={`${isUploadPreview ? 'w-full h-full object-cover' : 'max-h-48 object-contain'}`} />}
              {(f.type !== 'image') && (
                  <div className="flex flex-col items-center gap-1">
                       <DocumentTextIcon className="w-6 h-6 text-slate-500"/>
                       {!isUploadPreview && <span className="text-[10px] text-slate-400 truncate w-full text-center font-mono">{f.name}</span>}
                  </div>
              )}
            </div>
            {isUploadPreview && (
                <button 
                onClick={() => setFiles(files.filter(file => file.id !== f.id))}
                disabled={f.isUploading}
                className="absolute -top-1 -right-1 bg-red-900 text-white rounded-full p-0.5"
                >
                <XMarkIcon className="w-3 h-3" />
                </button>
            )}
          </div>
      );
  }

  const isScribe = mode === 'scribe';
  const accentColor = isScribe ? 'purple' : 'cyan';

  return (
    <div className="flex h-screen bg-[#030712] text-slate-200 font-sans overflow-hidden bg-grid relative">
      
      {/* Ambient Side Lighting */}
      <div className={`fixed top-0 left-0 w-64 md:w-96 h-full bg-gradient-to-r ${isScribe ? 'from-purple-900/15' : 'from-cyan-900/15'} to-transparent blur-[80px] pointer-events-none z-0`} />
      <div className={`fixed top-0 right-0 w-64 md:w-96 h-full bg-gradient-to-l ${isScribe ? 'from-purple-900/15' : 'from-cyan-900/15'} to-transparent blur-[80px] pointer-events-none z-0`} />

      {/* Settings Panel */}
      <div 
        className={`
          fixed inset-y-0 right-0 w-80 glass-panel border-l border-slate-700/50
          transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) z-50 shadow-2xl
          ${showSettings ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-10 border-b border-slate-700/50 pb-4">
             <h2 className="font-display font-bold text-lg text-white tracking-widest">SYSTEM_CONFIG</h2>
             <button onClick={() => setShowSettings(false)}><XMarkIcon className="w-5 h-5 text-slate-400 hover:text-white" /></button>
          </div>
          <div className="space-y-6 flex-1">
             <div className="bg-slate-900/50 p-4 border border-slate-800 rounded">
                <h3 className="text-[10px] font-mono uppercase text-slate-500 mb-4">Output Synthesis</h3>
                <div className="flex items-center justify-between mb-4">
                   <span className="text-sm">TTS Engine</span>
                   <button onClick={() => setTtsConfig(p => ({...p, enabled: !p.enabled}))} className={`w-8 h-4 rounded-full relative transition-colors ${ttsConfig.enabled ? (isScribe ? 'bg-purple-600' : 'bg-cyan-600') : 'bg-slate-700'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${ttsConfig.enabled ? 'left-4.5' : 'left-0.5'}`} />
                   </button>
                </div>
                <select 
                  onChange={(e) => setTtsConfig(p => ({...p, voiceURI: e.target.value}))}
                  className="w-full bg-black border border-slate-700 text-xs p-2 rounded"
                >
                  {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                </select>
             </div>
             <button onClick={clearHistory} className="w-full py-3 border border-red-900/30 text-red-500 hover:bg-red-900/10 text-xs font-mono tracking-widest uppercase">
                 Purge Cache
             </button>
          </div>
        </div>
      </div>

      {showSettings && <div className="fixed inset-0 bg-black/80 z-40 backdrop-blur-[2px]" onClick={() => setShowSettings(false)} />}

      {/* Main Chat */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full h-full relative z-10">
        
        {/* Header HUD */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#030712]/90 backdrop-blur-md z-30">
          <div className="flex items-center gap-4">
             <button onClick={onExit} className="hover:text-white text-slate-500 transition-colors"><ArrowLeftIcon className="w-5 h-5" /></button>
             <div>
               <h1 className="font-display font-bold text-white text-lg tracking-[0.1em]">
                 {mode === 'research' ? 'CLARA // RESEARCH' : 'CLARA // SCRIBE'}
               </h1>
               <div className={`flex items-center gap-2 text-[10px] font-mono mt-1 ${isScribe ? 'text-purple-500' : 'text-cyan-500'}`}>
                 <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isScribe ? 'bg-purple-500' : 'bg-cyan-500'}`}/>
                 {isLoading ? 'PROCESSING STREAM' : 'SECURE CONNECTION ACTIVE'}
               </div>
             </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-white transition-colors"><Cog6ToothIcon className="w-5 h-5" /></button>
        </header>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-10 scrollbar-hide">
          {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
                <CpuChipIcon className="w-32 h-32 text-white mb-4" />
                <div className="font-display text-4xl font-bold">READY</div>
             </div>
          )}

          {messages.map((msg, index) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[90%] md:max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                
                <div 
                  className={`
                    p-6 md:p-8 relative group w-full tech-card
                    ${msg.role === 'user' ? 'rounded-tl-xl rounded-bl-xl rounded-br-xl' : 'rounded-tr-xl rounded-br-xl rounded-bl-xl'}
                    ${msg.role === 'user' ? 'border-cyan-500/20 bg-cyan-950/10' : 'border-slate-700/50 bg-[#080c16]'}
                  `}
                >
                  {/* Decorative Header for Bot */}
                  {msg.role === 'assistant' && (
                      <div className={`absolute top-0 left-0 px-3 py-1 text-[9px] font-mono bg-slate-900 border-b border-r border-slate-800 text-slate-500 uppercase tracking-widest rounded-br`}>
                          AI_RESPONSE // {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                  )}

                  {msg.files && msg.files.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-3">
                      {msg.files.map((f, i) => renderFilePreview(f))}
                    </div>
                  )}
                  
                  <div className="text-sm md:text-base leading-relaxed font-light mt-2">
                    {msg.role === 'system' 
                      ? <span className="text-red-400 font-mono text-xs border border-red-900/50 bg-red-950/30 px-2 py-1">{msg.content}</span>
                      : renderMessageContent(msg.content)
                    }
                  </div>

                  {msg.role === 'assistant' && (
                     <div className="absolute -bottom-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {/* Feedback Buttons */}
                         <button 
                            onClick={() => handleFeedback(msg.id, 'like')} 
                            className={`bg-slate-900 border border-slate-700 p-1.5 rounded transition-colors ${msg.feedback === 'like' ? 'text-emerald-400 border-emerald-900' : 'text-slate-400 hover:text-white'}`}
                         >
                            <HandThumbUpIcon className="w-3 h-3" />
                         </button>
                         <button 
                            onClick={() => handleFeedback(msg.id, 'dislike')} 
                            className={`bg-slate-900 border border-slate-700 p-1.5 rounded transition-colors ${msg.feedback === 'dislike' ? 'text-red-400 border-red-900' : 'text-slate-400 hover:text-white'}`}
                         >
                            <HandThumbDownIcon className="w-3 h-3" />
                         </button>
                         {/* TTS Button */}
                         <button onClick={() => speak(msg.content)} className="bg-slate-900 border border-slate-700 text-slate-400 hover:text-white p-1.5 rounded"><SpeakerWaveIcon className="w-3 h-3" /></button>
                     </div>
                  )}
                </div>

                {/* Suggestions */}
                {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {msg.suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(q)}
                        className={`text-[11px] border px-4 py-2 rounded-sm transition-all flex items-center gap-2 hover:bg-slate-800
                          ${isScribe 
                            ? 'border-purple-900/30 text-purple-300' 
                            : 'border-cyan-900/30 text-cyan-300'
                          }`}
                      >
                         <span className="opacity-50">&gt;</span> {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
             <div className="flex justify-start">
                <div className="bg-[#080c16] border border-slate-800 p-4 rounded flex items-center gap-4 w-64">
                   <div className="relative w-8 h-8 flex items-center justify-center">
                      <div className={`absolute inset-0 border-2 rounded-full border-t-transparent animate-spin ${isScribe ? 'border-purple-500' : 'border-cyan-500'}`}></div>
                   </div>
                   <div className="flex flex-col">
                       <span className={`text-[10px] font-mono tracking-widest ${isScribe ? 'text-purple-500' : 'text-cyan-500'} animate-pulse`}>{loadingText}</span>
                       <div className="h-0.5 w-full bg-slate-800 mt-1 overflow-hidden">
                           <div className={`h-full w-1/3 animate-scanline ${isScribe ? 'bg-purple-500' : 'bg-cyan-500'}`}></div>
                       </div>
                   </div>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-4"/>
        </div>

        {/* Input Dock */}
        <div className="p-4 md:p-6 pb-8 relative z-20">
          <div className={`glass-panel p-1 rounded-xl border border-white/10 shadow-2xl transition-all duration-300 focus-within:border-${isScribe ? 'purple' : 'cyan'}-500/50`}>
            {files.length > 0 && <div className="flex gap-2 p-2 border-b border-white/5">{files.map((f) => renderFilePreview(f, true))}</div>}
            
            <div className="flex items-end gap-2 p-2">
               <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 text-slate-500 hover:text-white transition-colors"><PaperClipIcon className="w-5 h-5" /></button>
               <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload}/>

               <textarea
                 ref={textareaRef}
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                 disabled={isLoading}
                 placeholder="Enter query or voice command..."
                 className="flex-1 bg-transparent text-white placeholder-slate-600 focus:outline-none resize-none py-2 max-h-32 min-h-[40px] scrollbar-hide text-sm font-light"
                 rows={1}
               />
               
               <button onClick={toggleRecording} className={`p-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-500 hover:text-white'}`}><MicrophoneIcon className="w-5 h-5" /></button>
               
               <button 
                 onClick={() => handleSendMessage()}
                 disabled={!inputValue.trim() && files.length === 0}
                 className={`p-2 rounded transition-all ${(!inputValue.trim() && files.length === 0) ? 'text-slate-600' : (isScribe ? 'text-purple-400 bg-purple-900/20' : 'text-cyan-400 bg-cyan-900/20')}`}
               >
                 <PaperAirplaneIcon className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChatInterface;