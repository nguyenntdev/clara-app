import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeftIcon, 
  MicrophoneIcon, 
  StopIcon, 
  HeartIcon,
  SignalIcon,
  CpuChipIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/outline';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

interface PulseInterfaceProps {
  apiKey: string;
  onExit: () => void;
}

// -- Sentiment Analysis Helper --
const analyzeSentiment = (text: string): 'neutral' | 'positive' | 'negative' => {
  const positive = ['good', 'great', 'better', 'fine', 'happy', 'improving', 'resolved', 'thanks', 'excellent', 'relief', 'love', 'wonderful', 'yes', 'ok', 'calm'];
  const negative = ['bad', 'pain', 'worse', 'hurt', 'sick', 'ill', 'symptom', 'severe', 'dizzy', 'headache', 'fever', 'problem', 'hard', 'difficult', 'no', 'sad', 'scared', 'worried', 'emergency'];
  
  const tokens = text.toLowerCase().split(/[\s,.!?]+/);
  let score = 0;
  tokens.forEach(t => {
    if (positive.includes(t)) score++;
    if (negative.includes(t)) score--;
  });
  
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
};

// -- Audio Utilities --

function createBlob(data: Float32Array, sampleRate: number): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  return {
    data: base64Data,
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const PulseInterface: React.FC<PulseInterfaceProps> = ({ apiKey, onExit }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('STANDBY');
  const [isTalking, setIsTalking] = useState(false);
  const [latency, setLatency] = useState(0);
  
  // Subtitles
  const [userTranscript, setUserTranscript] = useState('');
  const [modelTranscript, setModelTranscript] = useState('');

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Playback cursor
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const sentimentRef = useRef<'neutral' | 'positive' | 'negative'>('neutral');

  // Transcription Accumulators
  const userAccRef = useRef('');
  const modelAccRef = useRef('');

  const startSession = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access not supported.");
      }

      setStatus("INITIALIZING...");
      const startTime = Date.now();
      
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      // 1. Setup Audio Contexts
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      
      // 2. Setup Input Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 2048; // High res for detailed visuals
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;

      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      setStatus("HANDSHAKE...");
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setLatency(Date.now() - startTime);
            setStatus("LINK ESTABLISHED");
            setIsConnected(true);
            setIsTalking(false);
            setUserTranscript('');
            setModelTranscript('');
            userAccRef.current = '';
            modelAccRef.current = '';
            sentimentRef.current = 'neutral';

            const source = inputCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               const pcmBlob = createBlob(inputData, inputCtx.sampleRate);
               sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
               });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const content = msg.serverContent;

            if (content?.inputTranscription) {
                setModelTranscript(''); 
                userAccRef.current += content.inputTranscription.text;
                setUserTranscript(userAccRef.current);
                sentimentRef.current = analyzeSentiment(userAccRef.current);
            }

            if (content?.outputTranscription) {
                setUserTranscript(''); 
                modelAccRef.current += content.outputTranscription.text;
                setModelTranscript(modelAccRef.current);
            }

            if (content?.turnComplete) {
                userAccRef.current = '';
                modelAccRef.current = '';
                setTimeout(() => { sentimentRef.current = 'neutral'; }, 1000);
            }

            const base64Audio = content?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsTalking(true);
              const audioBytes = decode(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, outputCtx, 24000, 1);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              
              source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) {
                     setIsTalking(false);
                 }
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (content?.interrupted) {
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setIsTalking(false);
               userAccRef.current = '';
               modelAccRef.current = '';
               setUserTranscript('');
               setModelTranscript('');
               sentimentRef.current = 'neutral';
            }
          },
          onclose: () => {
            setStatus("DISCONNECTED");
            setIsConnected(false);
          },
          onerror: (e) => {
            setStatus("ERR: SIGNAL LOSS");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: "You are CLARA Pulse, a futuristic medical AI interface. Your tone is professional, precise, yet reassuring. You monitor user health biomarkers via voice. Keep responses concise.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setStatus("INIT FAILURE");
    }
  };

  const stopSession = () => {
     if (sessionRef.current) {
        sessionRef.current.then((s: any) => s.close());
     }
     
     if (processorRef.current) {
         processorRef.current.disconnect();
         processorRef.current = null;
     }
     
     if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
         streamRef.current = null;
     }

     if (inputContextRef.current) inputContextRef.current.close();
     if (outputContextRef.current) outputContextRef.current.close();
     
     setIsConnected(false);
     setStatus("STANDBY");
     setUserTranscript('');
     setModelTranscript('');
  };

  // -- Visualizer Render Loop --
  useEffect(() => {
    if (!isConnected || !analyserRef.current || !canvasRef.current) return;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const analyser = analyserRef.current;
      if (!ctx || !analyser) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const timeDataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(timeDataArray);

      // 1. Fade / Trail Effect
      ctx.fillStyle = 'rgba(2, 6, 23, 0.25)'; // Dark Slate with transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 100;

      // Theme Colors (Holographic Neon)
      const colors = {
          neutral: { stroke: '#fb7185', glow: '#be123c' }, // Rose
          positive: { stroke: '#34d399', glow: '#059669' }, // Emerald
          negative: { stroke: '#f87171', glow: '#b91c1c' }  // Red
      };
      const theme = colors[sentimentRef.current] || colors.neutral;

      // 2. Draw Static HUD Reticle (Behind)
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 40, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)'; // Faint Cyan
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 15]);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Rotating Scanner Ring
      const time = performance.now() / 1000;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 60, time, time + 1.5);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. Circular FFT Bars (The "Crown")
      ctx.beginPath();
      for (let i = 0; i < bufferLength; i += 8) { // Skip for spacing
         const barHeight = (dataArray[i] / 255) * 80;
         const angle = (i / bufferLength) * Math.PI * 2 - (Math.PI / 2); // Start top
         
         const x1 = cx + Math.cos(angle) * (radius);
         const y1 = cy + Math.sin(angle) * (radius);
         const x2 = cx + Math.cos(angle) * (radius + barHeight);
         const y2 = cy + Math.sin(angle) * (radius + barHeight);

         ctx.moveTo(x1, y1);
         ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.strokeStyle = theme.stroke;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10; // Neon Glow
      ctx.shadowColor = theme.glow;
      ctx.stroke();
      
      // Reset Shadow for next layer
      ctx.shadowBlur = 0;

      // 4. Oscilloscope (The "Voice")
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      
      for(let i = 0; i < bufferLength; i+=4) {
        const v = timeDataArray[i] / 128.0;
        const distortion = (v - 1) * 40;
        const angle = (i / bufferLength) * Math.PI * 2;
        
        // Map wave to a smaller inner circle
        const r = (radius - 20) + distortion;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // 5. Center Core
      const avgVol = dataArray.reduce((a, b) => a + b) / bufferLength;
      ctx.beginPath();
      ctx.arc(cx, cy, 10 + (avgVol / 5), 0, Math.PI * 2);
      ctx.fillStyle = theme.stroke;
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isConnected]);

  return (
    <div className="relative flex flex-col h-screen bg-[#020617] text-white overflow-hidden font-sans selection:bg-rose-500/30">
        
        {/* Background Layer: Grid + Vignette */}
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617] pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-transparent to-[#020617] pointer-events-none"></div>

        {/* HUD Layer: Top Bar */}
        <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#020617]/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
                <button onClick={onExit} className="text-slate-500 hover:text-white transition-colors p-2 rounded hover:bg-white/5">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="font-display font-bold text-lg tracking-[0.15em] text-rose-500 flex items-center gap-2">
                        <HeartIcon className="w-5 h-5" />
                        CLARA PULSE
                    </h1>
                </div>
            </div>
            
            <div className="hidden md:flex items-center gap-8 font-mono text-[10px] tracking-widest text-slate-500">
                <div className="flex flex-col items-end">
                    <span>SYS.STATUS</span>
                    <span className={`${isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>{status}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span>LATENCY</span>
                    <span className="text-white">{isConnected ? `${latency}ms` : '--'}</span>
                </div>
            </div>
        </header>

        {/* HUD Layer: Side Widgets (Simulated Data) */}
        <div className="absolute top-32 left-6 z-10 hidden md:block opacity-50">
            <div className="font-mono text-[9px] text-rose-500/70 mb-2 tracking-widest border-b border-rose-500/20 pb-1 w-32">BIOMETRICS</div>
            <div className="space-y-2 font-mono text-xs text-slate-400">
                <div className="flex justify-between"><span>HRV</span> <span className="text-white">--</span></div>
                <div className="flex justify-between"><span>O2</span> <span className="text-white">--</span></div>
                <div className="flex justify-between"><span>VOICE</span> <span className={`${isTalking ? 'text-rose-400' : 'text-slate-600'}`}>{isTalking ? 'DETECTED' : 'SILENT'}</span></div>
            </div>
        </div>

        <div className="absolute top-32 right-6 z-10 hidden md:block opacity-50 text-right">
            <div className="font-mono text-[9px] text-cyan-500/70 mb-2 tracking-widest border-b border-cyan-500/20 pb-1 w-32 ml-auto">NEURAL LINK</div>
            <div className="space-y-2 font-mono text-xs text-slate-400">
                <div className="flex justify-end gap-2"><span>UPLINK</span> <SignalIcon className="w-4 h-4" /></div>
                <div className="flex justify-end gap-2"><span>CORE</span> <CpuChipIcon className="w-4 h-4" /></div>
                <div className="flex justify-end gap-2"><span>MODEL</span> <span>GEM-2.5</span></div>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4">
            
            {/* Holographic Visualizer */}
            <div className="relative w-[340px] h-[340px] md:w-[500px] md:h-[500px] flex items-center justify-center mb-8">
                {/* Standby Pulse */}
                {!isConnected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 border border-slate-800 rounded-full animate-pulse-ring opacity-20"></div>
                        <div className="w-32 h-32 border border-slate-800 rounded-full animate-pulse-ring delay-75 opacity-20"></div>
                        <CubeTransparentIcon className="w-16 h-16 text-slate-700 animate-float" />
                    </div>
                )}
                
                <canvas 
                    ref={canvasRef} 
                    width={500} 
                    height={500} 
                    className={`w-full h-full transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-30 blur-sm'}`}
                />
            </div>

            {/* Subtitles / Chat Log */}
            <div className="absolute bottom-32 md:bottom-40 w-full max-w-2xl px-4 flex flex-col items-center gap-4">
                {userTranscript && (
                    <div className="glass-panel px-6 py-3 rounded-full border border-slate-700/50 flex items-center gap-3 animate-in slide-in-from-bottom-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                        <p className="text-lg font-light text-slate-200">{userTranscript}</p>
                    </div>
                )}
                
                {modelTranscript && (
                    <div className="glass-panel px-6 py-3 rounded-full border border-rose-500/30 flex items-center gap-3 animate-in slide-in-from-bottom-2 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                        <p className="text-lg font-medium text-rose-100 drop-shadow-md">{modelTranscript}</p>
                    </div>
                )}
                
                {isConnected && !userTranscript && !modelTranscript && (
                   <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 animate-pulse">
                       AWAITING AUDIO INPUT
                   </div>
                )}
            </div>

        </div>

        {/* Bottom Control Deck */}
        <div className="relative z-20 pb-8 pt-4 bg-gradient-to-t from-[#020617] to-transparent">
            <div className="flex justify-center items-center gap-8">
                
                {!isConnected ? (
                    <button 
                        onClick={startSession}
                        className="group relative flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-rose-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                        <div className="relative w-20 h-20 rounded-full bg-[#0a0f1e] border border-rose-500/30 flex items-center justify-center group-hover:border-rose-400 group-hover:scale-105 transition-all shadow-2xl">
                             <MicrophoneIcon className="w-8 h-8 text-rose-500" />
                        </div>
                        <div className="absolute -bottom-8 text-[10px] font-mono tracking-widest text-slate-500 group-hover:text-rose-400 transition-colors">INITIALIZE</div>
                    </button>
                ) : (
                    <button 
                        onClick={stopSession}
                        className="group relative flex items-center justify-center"
                    >
                         <div className="absolute inset-0 bg-red-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                         <div className="relative w-20 h-20 rounded-full bg-[#0a0f1e] border border-red-500/30 flex items-center justify-center group-hover:border-red-400 group-hover:scale-105 transition-all shadow-2xl">
                             <StopIcon className="w-8 h-8 text-red-500" />
                        </div>
                        <div className="absolute -bottom-8 text-[10px] font-mono tracking-widest text-red-900 group-hover:text-red-500 transition-colors">TERMINATE</div>
                    </button>
                )}

            </div>
        </div>

    </div>
  );
};

export default PulseInterface;