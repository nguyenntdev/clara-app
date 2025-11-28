import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeftIcon, 
  MicrophoneIcon, 
  StopIcon, 
  HeartIcon,
  SignalIcon,
  CpuChipIcon,
  ShieldCheckIcon
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
    // Clamp values to -1..1 range then convert to PCM16
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
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
  sampleRate: number = 24000,
  numChannels: number = 1,
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
  const [status, setStatus] = useState('SYSTEM IDLE');
  const [isTalking, setIsTalking] = useState(false);
  
  // Subtitles
  const [userTranscript, setUserTranscript] = useState('');
  const [modelTranscript, setModelTranscript] = useState('');

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null); // Promise of session
  const activeSessionRef = useRef<any>(null); // Actual resolved session object
  const processorRef = useRef<ScriptProcessorNode | null>(null); // Keep reference to prevent GC
  
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

  // Initial Setup cleanup
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const startSession = async () => {
    try {
      setStatus("INITIALIZING BIOS...");
      
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      // 1. Setup Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Explicit resume to handle browser autoplay policies
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      
      // 2. Setup Input Stream
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: inputCtx.sampleRate // Try to match context rate
            } 
        });
      } catch (e) {
          console.error(e);
          alert("Microphone access denied. Please allow microphone permissions in your browser settings.");
          setStatus("MIC ACCESS DENIED");
          return;
      }
      
      const source = inputCtx.createMediaStreamSource(stream);
      
      // Analyser for Visualizer
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Script Processor for raw PCM extraction
      // Buffer size 4096 provides good balance between latency and performance
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = scriptProcessor; // CRITICAL: Prevent GC

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination); // Required for script processor to run

      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // 3. Connect to Gemini Live
      setStatus("CONNECTING TO NEURAL CORE...");
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            console.log("Connected to Gemini Live");
            setStatus("LIVE CONNECTION ESTABLISHED");
            setIsConnected(true);
            setIsTalking(false);
            setUserTranscript('');
            setModelTranscript('');
            userAccRef.current = '';
            modelAccRef.current = '';
            sentimentRef.current = 'neutral';
            
            // Resolve the session and store it for the audio loop
            const session = await sessionPromise;
            activeSessionRef.current = session;
          },
          onmessage: async (msg: LiveServerMessage) => {
            const content = msg.serverContent;

            // Handle Transcriptions
            if (content?.inputTranscription) {
                // User is speaking
                setModelTranscript(''); // Clear model text to focus on user
                userAccRef.current += content.inputTranscription.text;
                setUserTranscript(userAccRef.current);
                sentimentRef.current = analyzeSentiment(userAccRef.current);
            }

            if (content?.outputTranscription) {
                // Model is speaking
                setUserTranscript(''); // Clear user text to focus on model
                modelAccRef.current += content.outputTranscription.text;
                setModelTranscript(modelAccRef.current);
            }

            if (content?.turnComplete) {
                userAccRef.current = '';
                modelAccRef.current = '';
                setTimeout(() => { sentimentRef.current = 'neutral'; }, 1500);
            }

            // Handle Audio Output
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

            // Handle Interruptions
            if (content?.interrupted) {
               console.log("Interrupted");
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setIsTalking(false);
               userAccRef.current = '';
               modelAccRef.current = '';
            }
          },
          onclose: () => {
            console.log("Disconnected");
            setStatus("CONNECTION TERMINATED");
            setIsConnected(false);
            activeSessionRef.current = null;
            processorRef.current = null;
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            setStatus("CONNECTION ERROR");
            setIsConnected(false);
            alert("Connection Error. Please check your API key or internet connection.");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: "You are CLARA Pulse, a professional medical AI assistant. You speak with a calm, reassuring, and precise tone. You utilize the OPQRST method for symptom checking. Keep responses concise (under 2 sentences when possible) for a natural conversation flow. Do not output markdown, just plain text suitable for speech.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          }
        }
      });
      
      sessionRef.current = sessionPromise;
      
      // Start sending audio chunks ONLY when session is active
      scriptProcessor.onaudioprocess = (e) => {
         if (!activeSessionRef.current) return;
         
         const inputData = e.inputBuffer.getChannelData(0);
         const pcmBlob = createBlob(inputData, inputCtx.sampleRate);
         
         activeSessionRef.current.sendRealtimeInput({ media: pcmBlob });
      };

    } catch (err) {
      console.error("Failed to start session", err);
      setStatus("INITIALIZATION FAILED");
      alert("Failed to initialize. Check console for details.");
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
     if (inputContextRef.current) inputContextRef.current.close();
     if (outputContextRef.current) outputContextRef.current.close();
     
     activeSessionRef.current = null;
     setIsConnected(false);
     setStatus("SYSTEM IDLE");
  };

  // -- Visualizer --
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rotation = 0;
    
    // Particle System
    const particles: {x: number, y: number, vx: number, vy: number, life: number}[] = [];
    for(let i=0; i<20; i++) {
        particles.push({x: 0, y:0, vx: 0, vy: 0, life: 0});
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Determine Theme
      const colors = {
          neutral: { r: 251, g: 113, b: 133 }, // Rose
          positive: { r: 52, g: 211, b: 153 }, // Emerald
          negative: { r: 248, g: 113, b: 113 } // Red
      };
      const c = colors[sentimentRef.current] || colors.neutral;
      const themeColor = `rgb(${c.r}, ${c.g}, ${c.b})`;
      const themeColorAlpha = (a: number) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

      if (isConnected && analyserRef.current) {
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);

          const timeArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteTimeDomainData(timeArray);

          rotation += 0.005;

          // 1. Frequency Turbine (Outer)
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(rotation);
          
          for (let i = 0; i < bufferLength; i += 4) {
             const v = dataArray[i] / 255.0;
             const height = v * 80;
             
             ctx.rotate( (Math.PI * 2) / (bufferLength / 4) );
             
             ctx.beginPath();
             ctx.fillStyle = themeColorAlpha(0.2 + v * 0.8);
             ctx.rect(60, -1, height, 2);
             ctx.fill();
             
             if (v > 0.5) {
                 ctx.fillStyle = '#fff';
                 ctx.rect(60 + height, -1, 2, 2);
                 ctx.fill();
             }
          }
          ctx.restore();

          // 2. Oscilloscope Ring (Middle)
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.strokeStyle = themeColor;
          ctx.shadowBlur = 15;
          ctx.shadowColor = themeColor;
          
          const radius = 50;
          for (let i = 0; i < bufferLength; i++) {
              const v = timeArray[i] / 128.0;
              const angle = (i / bufferLength) * Math.PI * 2;
              const r = radius + (v - 1) * 30; // Increased sensitivity
              const x = centerX + Math.cos(angle) * r;
              const y = centerY + Math.sin(angle) * r;
              
              if (i===0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.shadowBlur = 0;

          // 3. Core Pulse
          const avgVolume = dataArray.reduce((a,b) => a+b) / bufferLength;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 20 + avgVolume/3, 0, Math.PI * 2); // Increased sensitivity
          ctx.fillStyle = themeColorAlpha(0.3 + avgVolume/150);
          ctx.fill();
          
          // 4. Particles emitting from core
          if (avgVolume > 10) { // Lower threshold
              const pIndex = Math.floor(Math.random() * particles.length);
              if (particles[pIndex].life <= 0) {
                  const angle = Math.random() * Math.PI * 2;
                  particles[pIndex] = {
                      x: centerX, y: centerY,
                      vx: Math.cos(angle) * 2,
                      vy: Math.sin(angle) * 2,
                      life: 1.0
                  };
              }
          }
          
          particles.forEach(p => {
              if (p.life > 0) {
                  p.x += p.vx;
                  p.y += p.vy;
                  p.life -= 0.02;
                  ctx.beginPath();
                  ctx.fillStyle = themeColorAlpha(p.life);
                  ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
                  ctx.fill();
              }
          });

      } else {
          // Idle Animation (Breathing Ring)
          const time = Date.now() / 1000;
          const scale = 1 + Math.sin(time * 2) * 0.05;
          
          ctx.beginPath();
          ctx.strokeStyle = '#334155'; // Slate-700
          ctx.lineWidth = 1;
          ctx.arc(centerX, centerY, 60 * scale, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.strokeStyle = '#334155';
          ctx.setLineDash([5, 15]);
          ctx.arc(centerX, centerY, 80, time/4, time/4 + Math.PI*2);
          ctx.stroke();
          ctx.setLineDash([]);
      }

      // HUD Reticles (Static)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.arc(centerX, centerY, 140, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.moveTo(centerX - 150, centerY);
      ctx.lineTo(centerX - 130, centerY);
      ctx.moveTo(centerX + 130, centerY);
      ctx.lineTo(centerX + 150, centerY);
      ctx.moveTo(centerX, centerY - 150);
      ctx.lineTo(centerX, centerY - 130);
      ctx.moveTo(centerX, centerY + 130);
      ctx.lineTo(centerX, centerY + 150);
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isConnected]);

  return (
    <div className="flex flex-col h-screen bg-[#02040a] relative overflow-hidden font-sans text-slate-200">
        
        {/* Background Gradients & Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-950/20 via-[#02040a] to-[#02040a] z-0"></div>
        <div className="absolute inset-0 bg-grid opacity-10 z-0 pointer-events-none" style={{ backgroundSize: '40px 40px', maskImage: 'linear-gradient(to bottom, black, transparent)' }}></div>

        {/* HUD Corners */}
        <div className="absolute top-0 left-0 p-8 z-10 hidden md:block">
            <div className="border-l-2 border-t-2 border-rose-500/30 w-16 h-16 absolute top-6 left-6"></div>
            <div className="font-mono text-[10px] text-rose-500/60 tracking-[0.2em] mb-1">SYSTEM_STATUS</div>
            <div className="font-display text-xl text-white">{status}</div>
        </div>
        <div className="absolute top-0 right-0 p-8 z-10 text-right hidden md:block">
            <div className="border-r-2 border-t-2 border-rose-500/30 w-16 h-16 absolute top-6 right-6"></div>
            <div className="font-mono text-[10px] text-rose-500/60 tracking-[0.2em] mb-1">LATENCY</div>
            <div className="font-display text-xl text-white">{isConnected ? "24ms" : "--"}</div>
        </div>
        <div className="absolute bottom-0 left-0 p-8 z-10 hidden md:block">
            <div className="border-l-2 border-bottom-2 border-rose-500/30 w-16 h-16 absolute bottom-6 left-6 border-b-2"></div>
            <div className="font-mono text-[10px] text-rose-500/60 tracking-[0.2em] mb-1">BIO_METRICS</div>
            <div className="font-display text-xl text-white flex items-center gap-2">
                <HeartIcon className="w-5 h-5 text-rose-500 animate-pulse" />
                {isConnected ? "ACTIVE" : "STANDBY"}
            </div>
        </div>

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-6 py-6 backdrop-blur-sm border-b border-white/5">
            <button onClick={onExit} className="text-slate-400 hover:text-white transition-colors group flex items-center gap-2">
                <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-mono tracking-widest">EXIT_MODULE</span>
            </button>
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldCheckIcon className="w-4 h-4 text-rose-500" />
                    <h1 className="font-display font-bold text-lg text-white tracking-[0.2em]">CLARA PULSE</h1>
                </div>
                <div className="h-0.5 w-24 bg-rose-900/50 overflow-hidden rounded-full">
                    <div className={`h-full bg-rose-500 transition-all duration-1000 ${isConnected ? 'w-full animate-pulse' : 'w-0'}`}></div>
                </div>
            </div>
            <div className="w-24 text-right">
                <CpuChipIcon className={`w-5 h-5 ml-auto ${isConnected ? 'text-rose-400 animate-spin-slow' : 'text-slate-600'}`} />
            </div>
        </header>

        {/* Main Interface */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-5xl mx-auto">
            
            {/* Holographic Projector (Visualizer) */}
            <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] flex items-center justify-center mb-12">
                 {/* Decorative Rings */}
                 <div className={`absolute inset-0 border border-rose-500/10 rounded-full ${isConnected ? 'animate-[spin_10s_linear_infinite]' : ''}`}></div>
                 <div className={`absolute inset-4 border border-rose-500/20 rounded-full border-dashed ${isConnected ? 'animate-[spin_15s_linear_infinite_reverse]' : ''}`}></div>
                 
                 {/* Canvas */}
                 <canvas 
                    ref={canvasRef} 
                    width={500} 
                    height={500} 
                    className="w-full h-full relative z-20"
                 />

                 {/* Standby Icon */}
                 {!isConnected && (
                     <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                         <div className="bg-slate-900/80 p-6 rounded-full border border-slate-700 backdrop-blur-md">
                             <SignalIcon className="w-12 h-12 text-slate-500" />
                         </div>
                     </div>
                 )}
            </div>
            
            {/* Subtitles / Log */}
            <div className="w-full max-w-3xl px-6 min-h-[120px] flex flex-col items-center justify-center text-center space-y-4">
                {userTranscript && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-xs font-mono text-slate-500 tracking-widest mb-1 block">USER_INPUT</span>
                        <p className="text-xl md:text-2xl font-light text-white leading-relaxed">
                            "{userTranscript}"
                        </p>
                    </div>
                )}
                {modelTranscript && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                        <span className="text-xs font-mono text-rose-500 tracking-widest mb-1 block">CLARA_RESPONSE</span>
                        <p className="text-xl md:text-2xl font-medium text-rose-200 leading-relaxed drop-shadow-[0_0_10px_rgba(251,113,133,0.3)]">
                            {modelTranscript}
                        </p>
                    </div>
                )}
                
                {!userTranscript && !modelTranscript && (
                    <p className="text-xs font-mono text-slate-600 tracking-[0.3em] animate-pulse">
                        {isConnected ? "LISTENING FOR VOCAL INPUT..." : "SYSTEM STANDBY - AWAITING CONNECTION"}
                    </p>
                )}
            </div>
        </div>

        {/* Control Deck */}
        <div className="relative z-20 pb-12 flex justify-center items-center">
            <div className="glass-panel px-10 py-6 rounded-full border border-white/10 shadow-2xl flex items-center gap-12">
                {!isConnected ? (
                    <button 
                      onClick={startSession}
                      className="group relative flex items-center justify-center"
                    >
                        <div className="w-20 h-20 rounded-full bg-rose-600 group-hover:bg-rose-500 transition-all flex items-center justify-center shadow-[0_0_40px_rgba(225,29,72,0.4)] group-hover:shadow-[0_0_60px_rgba(225,29,72,0.6)]">
                            <MicrophoneIcon className="w-8 h-8 text-white" />
                        </div>
                        <span className="absolute -bottom-8 text-[10px] font-mono tracking-widest text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">INITIATE UPLINK</span>
                    </button>
                ) : (
                    <button 
                      onClick={stopSession}
                      className="group relative flex items-center justify-center"
                    >
                        <div className="w-20 h-20 rounded-full bg-slate-800 border border-red-500/50 group-hover:border-red-500 group-hover:bg-red-950/30 transition-all flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                             <div className="w-8 h-8 rounded bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                        </div>
                        <span className="absolute -bottom-8 text-[10px] font-mono tracking-widest text-red-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">TERMINATE LINK</span>
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default PulseInterface;