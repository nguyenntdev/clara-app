import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeftIcon, 
  MicrophoneIcon, 
  StopIcon, 
  HeartIcon 
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

// -- Audio Utilities (From Google GenAI SDK Examples) --

function createBlob(data: Float32Array): Blob {
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
    mimeType: 'audio/pcm;rate=16000',
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
  const [status, setStatus] = useState('READY TO CONNECT');
  const [isTalking, setIsTalking] = useState(false);
  
  // Subtitles
  const [userTranscript, setUserTranscript] = useState('');
  const [modelTranscript, setModelTranscript] = useState('');

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  
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
      setStatus("INITIALIZING AUDIO STREAMS...");
      
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      // 1. Setup Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      
      // 2. Setup Input Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputCtx.createMediaStreamSource(stream);
      
      // Analyser for Visualizer
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Script Processor for raw PCM extraction
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // 3. Connect to Gemini Live
      setStatus("ESTABLISHING NEURAL UPLINK...");
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Connected to Gemini Live");
            setStatus("LISTENING");
            setIsConnected(true);
            setIsTalking(false);
            setUserTranscript('');
            setModelTranscript('');
            userAccRef.current = '';
            modelAccRef.current = '';
            sentimentRef.current = 'neutral';

            // Start sending audio chunks
            scriptProcessor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               const pcmBlob = createBlob(inputData);
               sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
               });
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
            const content = msg.serverContent;

            // Handle Transcriptions
            if (content?.inputTranscription) {
                // User is speaking
                setModelTranscript(''); // Clear model text to focus on user
                userAccRef.current += content.inputTranscription.text;
                setUserTranscript(userAccRef.current);
                
                // Real-time sentiment analysis
                sentimentRef.current = analyzeSentiment(userAccRef.current);
            }

            if (content?.outputTranscription) {
                // Model is speaking
                setUserTranscript(''); // Clear user text to focus on model
                modelAccRef.current += content.outputTranscription.text;
                setModelTranscript(modelAccRef.current);
            }

            if (content?.turnComplete) {
                // Reset accumulators for the next turn
                userAccRef.current = '';
                modelAccRef.current = '';
                // Reset sentiment slightly delayed or keep for context? 
                // Let's reset to neutral for the start of next turn
                setTimeout(() => { sentimentRef.current = 'neutral'; }, 1000);
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
                 // If no sources left playing, model stopped talking
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
               
               // Clear transcripts on interruption
               userAccRef.current = '';
               modelAccRef.current = '';
               setUserTranscript('');
               setModelTranscript('');
               sentimentRef.current = 'neutral';
            }
          },
          onclose: () => {
            console.log("Disconnected");
            setStatus("DISCONNECTED");
            setIsConnected(false);
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            setStatus("CONNECTION ERROR");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: "You are CLARA Pulse, a friendly and empathetic personal health companion. You help users with diet planning, general wellness advice, and symptom checking. Keep answers concise, conversational, and warm. You are NOT a doctor and should always advise seeing a professional for serious issues.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start session", err);
      setStatus("FAILED TO INITIALIZE");
    }
  };

  const stopSession = () => {
     if (sessionRef.current) {
        sessionRef.current.then((s: any) => s.close());
     }
     
     if (inputContextRef.current) inputContextRef.current.close();
     if (outputContextRef.current) outputContextRef.current.close();
     
     setIsConnected(false);
     setStatus("READY TO CONNECT");
     setUserTranscript('');
     setModelTranscript('');
  };

  // Visualizer Loop
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

      // Create a time domain array for waveform
      const timeDataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(timeDataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 80;

      // Determine Colors based on Sentiment
      const colors = {
          neutral: { stroke: '#fb7185', fill: 'rgba(251, 113, 133, ' }, // Rose-400
          positive: { stroke: '#34d399', fill: 'rgba(52, 211, 153, ' }, // Emerald-400
          negative: { stroke: '#f87171', fill: 'rgba(248, 113, 113, ' }  // Red-400
      };
      const theme = colors[sentimentRef.current] || colors.neutral;

      // 1. Draw Outer Frequency Ring
      ctx.beginPath();
      for (let i = 0; i < bufferLength; i++) {
         const barHeight = dataArray[i] / 2.5; // Scale down
         const angle = (i * 2 * Math.PI) / bufferLength;
         
         // Rotate the ring slowly
         const rotationOffset = performance.now() / 2000;
         const finalAngle = angle + rotationOffset;

         const x = centerX + Math.cos(finalAngle) * (baseRadius + barHeight);
         const y = centerY + Math.sin(finalAngle) * (baseRadius + barHeight);
         
         if (i === 0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = theme.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Draw Inner Oscilloscope (Waveform)
      ctx.beginPath();
      const innerRadius = 50;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff1f2'; // Rose-50 (Always whiteish for core)
      
      for(let i = 0; i < bufferLength; i++) {
        const v = timeDataArray[i] / 128.0; // 0..2
        const yOffset = (v - 1) * 30; // Deviation
        // Map line across center
        const x = (i / bufferLength) * 140 + (centerX - 70);
        const y = centerY + yOffset;
        
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 3. Inner Glow / Core
      const avg = dataArray.reduce((a, b) => a + b) / bufferLength;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius - 5, 0, 2 * Math.PI);
      // Dynamic fill color opacity based on volume
      ctx.fillStyle = `${theme.fill}${0.05 + (avg/1000)})`; 
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isConnected]);

  return (
    <div className="flex flex-col h-screen bg-[#030712] relative overflow-hidden font-sans">
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-rose-900/10 to-transparent pointer-events-none"></div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-6">
            <button onClick={onExit} className="text-slate-400 hover:text-white transition-colors">
                <ArrowLeftIcon className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center">
                <h1 className="font-display font-bold text-xl text-white tracking-widest">CLARA PULSE</h1>
                <span className="text-[10px] font-mono text-rose-500 tracking-[0.2em]">{status}</span>
            </div>
            <div className="w-6"></div> {/* Spacer */}
        </header>

        {/* Main Visualizer Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            
            {/* Visualizer Canvas Container */}
            <div className="relative w-80 h-80 flex items-center justify-center mb-8">
                 {!isConnected && (
                     <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                         <HeartIcon className="w-24 h-24 text-slate-800" />
                     </div>
                 )}
                 <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={400} 
                    className={`w-full h-full transition-opacity duration-500 ${isConnected ? 'opacity-100' : 'opacity-0'}`}
                 />
                 
                 {/* Center Orb (Active Speaker Indicator) */}
                 {isConnected && (
                   <div className={`absolute w-24 h-24 rounded-full blur-2xl transition-all duration-300 pointer-events-none ${isTalking ? 'bg-rose-500/50 scale-125' : 'bg-rose-500/10 scale-100'}`}></div>
                 )}
            </div>
            
            {/* Subtitles Area */}
            <div className="w-full max-w-2xl px-6 h-24 flex items-center justify-center text-center">
                {userTranscript && (
                    <p className="text-lg md:text-xl font-light text-slate-300 animate-in fade-in slide-in-from-bottom-2">
                        "{userTranscript}"
                    </p>
                )}
                {modelTranscript && (
                    <p className="text-lg md:text-xl font-medium text-rose-300 animate-in fade-in slide-in-from-bottom-2 text-shadow-glow">
                        {modelTranscript}
                    </p>
                )}
                {!userTranscript && !modelTranscript && isConnected && (
                     <p className="text-sm text-slate-600 font-mono tracking-widest animate-pulse">LISTENING...</p>
                )}
            </div>

            <p className="mt-8 text-slate-500 font-light text-center max-w-md px-6 leading-relaxed text-xs">
                {isConnected 
                  ? "Speak naturally. CLARA is analyzing vocal biomarkers."
                  : "Tap the microphone to start a secure voice session."}
            </p>
        </div>

        {/* Controls */}
        <div className="relative z-20 pb-16 flex justify-center items-center gap-8">
            {!isConnected ? (
                <button 
                  onClick={startSession}
                  className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-slate-900 border border-rose-500/50 hover:border-rose-400 transition-all shadow-[0_0_30px_rgba(244,63,94,0.2)]"
                >
                    <div className="absolute inset-0 rounded-full bg-rose-500/10 group-hover:scale-110 transition-transform duration-500"></div>
                    <MicrophoneIcon className="w-8 h-8 text-rose-500" />
                </button>
            ) : (
                <button 
                  onClick={stopSession}
                  className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-slate-900 border border-red-500/50 hover:border-red-400 transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                >
                     <div className="absolute inset-0 rounded-full bg-red-500/10 group-hover:scale-110 transition-transform duration-500"></div>
                     <StopIcon className="w-8 h-8 text-red-500" />
                </button>
            )}
        </div>
    </div>
  );
};

export default PulseInterface;