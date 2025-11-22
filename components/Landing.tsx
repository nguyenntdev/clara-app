import React from 'react';
import { BeakerIcon, DocumentTextIcon, CpuChipIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { CONSTANTS } from '../types';

interface LandingProps {
  onSelectModule: (mode: 'research' | 'scribe', key: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onSelectModule }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-x-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Nav */}
      <nav className="relative z-10 flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-cyan-500 flex items-center justify-center">
            <CpuChipIcon className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="font-display font-bold text-xl tracking-widest">CLARA</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm text-slate-400 font-mono tracking-wide">
          <a href="#" className="hover:text-cyan-400 transition-colors">ABOUT</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">FEATURES</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">TECH</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">CASES</a>
        </div>
        <button className="px-6 py-2 bg-white text-black font-bold text-sm rounded-full hover:bg-cyan-50 transition-colors">
          GET STARTED
        </button>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center text-center mt-20 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/20 text-cyan-400 text-xs font-mono mb-8">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
          SYSTEM OPERATIONAL V1.0
        </div>
        
        <h1 className="font-display text-5xl md:text-8xl font-black tracking-tighter mb-6 neon-text leading-tight">
          MEDICAL<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">INTELLIGENCE</span>
        </h1>
        
        <p className="max-w-2xl text-slate-400 text-lg md:text-xl leading-relaxed mb-12">
          A specialized agentic framework bridging the gap between global medical evidence and clinical decision-making in Vietnam.
        </p>

        <div className="flex flex-col md:flex-row gap-4">
          <button 
            onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-md font-bold tracking-wide shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
          >
            DISCOVER CLARA &rarr;
          </button>
          <button className="px-8 py-4 glass-panel rounded-md font-bold tracking-wide hover:bg-slate-800/50 transition-all border-slate-700">
            VIEW ARCHITECTURE
          </button>
        </div>
      </div>

      {/* Modules Section */}
      <div id="modules" className="relative z-10 max-w-7xl mx-auto mt-32 px-4 pb-20">
        <div className="flex items-center gap-2 mb-12 justify-center">
            <span className="w-1 h-1 bg-cyan-500 rounded-full"></span>
            <span className="text-cyan-500 text-xs font-mono tracking-[0.3em] uppercase">Core Modules</span>
            <span className="w-1 h-1 bg-cyan-500 rounded-full"></span>
        </div>
        
        <h2 className="font-display text-4xl md:text-5xl font-bold text-center mb-16">INTELLIGENT MODULES</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Research Module Card */}
          <div 
            onClick={() => onSelectModule('research', CONSTANTS.KEYS.RESEARCH)}
            className="group glass-panel p-8 rounded-2xl hover:border-cyan-500/50 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <BeakerIcon className="w-32 h-32 text-cyan-500" />
            </div>
            <div className="w-12 h-12 rounded-lg bg-cyan-950 flex items-center justify-center mb-6 group-hover:bg-cyan-900 transition-colors">
              <BeakerIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-4">CLARA Research</h3>
            <p className="text-slate-400 leading-relaxed mb-6 h-20">
              An Agentic RAG system that autonomously plans, retrieves, and synthesizes medical evidence from trusted global sources like PubMed and ClinicalTrials.gov.
            </p>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded bg-cyan-950/50 border border-cyan-900 text-cyan-400 text-xs font-mono">#PubMed</span>
              <span className="px-3 py-1 rounded bg-cyan-950/50 border border-cyan-900 text-cyan-400 text-xs font-mono">#EvidenceBased</span>
            </div>
          </div>

          {/* Scribe Module Card */}
          <div 
            onClick={() => onSelectModule('scribe', CONSTANTS.KEYS.SCRIBE)}
            className="group glass-panel p-8 rounded-2xl hover:border-purple-500/50 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <DocumentTextIcon className="w-32 h-32 text-purple-500" />
            </div>
            <div className="w-12 h-12 rounded-lg bg-purple-950/50 flex items-center justify-center mb-6 group-hover:bg-purple-900/50 transition-colors">
              <DocumentTextIcon className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-4">CLARA Scribe</h3>
            <p className="text-slate-400 leading-relaxed mb-6 h-20">
              Real-time clinical conversation processing. Converts audio into structured FHIR-compliant medical records while automatically redacting sensitive PII.
            </p>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded bg-purple-950/30 border border-purple-900 text-purple-400 text-xs font-mono">#WhisperAI</span>
              <span className="px-3 py-1 rounded bg-purple-950/30 border border-purple-900 text-purple-400 text-xs font-mono">#FHIR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Tech Stack */}
      <div className="border-t border-slate-800 bg-slate-950 py-12">
         <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8 text-sm text-slate-500 font-mono">
            <div>
               <h4 className="text-white mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4" /> Privacy Core
               </h4>
               <p>ISO/HIPAA compliant redaction engine ensures patient data safety.</p>
            </div>
            <div>
               <h4 className="text-white mb-4 flex items-center gap-2">
                  <CpuChipIcon className="w-4 h-4" /> Neural Processing
               </h4>
               <p>Advanced LLM orchestration for complex clinical query reasoning.</p>
            </div>
            <div className="text-right">
               <p>&copy; 2025 PROJECT CLARA</p>
               <p>All systems nominal.</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Landing;