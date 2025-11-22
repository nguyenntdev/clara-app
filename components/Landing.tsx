import React from 'react';
import { 
  BeakerIcon, 
  DocumentTextIcon, 
  CpuChipIcon, 
  ShieldCheckIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BoltIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  SparklesIcon,
  BuildingLibraryIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';
import { CONSTANTS } from '../types';

interface LandingProps {
  onSelectModule: (mode: 'research' | 'scribe', key: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onSelectModule }) => {
  return (
    <div className="min-h-screen text-white overflow-x-hidden relative selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* 3D Immersive Background - Neural Data Field */}
      <div className="fixed inset-0 z-0 overflow-hidden flex items-center justify-center pointer-events-none">
        <div className="relative w-[150vh] h-[150vh] perspective-2000 opacity-40">
           {/* Rotating 3D Plane */}
           <div className="w-full h-full transform-style-3d animate-[spin_120s_linear_infinite] flex items-center justify-center">
              
              {/* Tilted Plane Effect */}
              <div className="absolute inset-0 transform rotate-x-[60deg] transform-style-3d">
                  
                  {/* Orbit Ring 1 (Outer) */}
                  <div className="absolute top-[10%] left-[10%] right-[10%] bottom-[10%] border border-slate-700/30 rounded-full shadow-[0_0_50px_rgba(6,182,212,0.05)]"></div>
                  
                  {/* Orbit Ring 2 (Middle) */}
                  <div className="absolute top-[25%] left-[25%] right-[25%] bottom-[25%] border border-slate-700/20 rounded-full border-dashed"></div>

                  {/* Data Nodes Floating in 3D */}
                  {/* Node 1 */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 transform-style-3d animate-[spin_20s_linear_infinite_reverse]">
                      <div className="p-4 bg-slate-900/80 border border-cyan-500/30 rounded-xl transform rotate-x-[-60deg]">
                          <GlobeAltIcon className="w-12 h-12 text-cyan-500/50" />
                      </div>
                  </div>

                  {/* Node 2 */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 transform-style-3d animate-[spin_25s_linear_infinite_reverse]">
                      <div className="p-4 bg-slate-900/80 border border-purple-500/30 rounded-xl transform rotate-x-[-60deg]">
                          <BeakerIcon className="w-12 h-12 text-purple-500/50" />
                      </div>
                  </div>

                  {/* Node 3 */}
                  <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 transform-style-3d animate-[spin_30s_linear_infinite_reverse]">
                      <div className="p-4 bg-slate-900/80 border border-blue-500/30 rounded-xl transform rotate-x-[-60deg]">
                          <DocumentTextIcon className="w-12 h-12 text-blue-500/50" />
                      </div>
                  </div>

                  {/* Node 4 */}
                  <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 transform-style-3d animate-[spin_35s_linear_infinite_reverse]">
                      <div className="p-4 bg-slate-900/80 border border-emerald-500/30 rounded-xl transform rotate-x-[-60deg]">
                          <UserGroupIcon className="w-12 h-12 text-emerald-500/50" />
                      </div>
                  </div>
                  
                  {/* Central Core Connection Lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-10">
                     <line x1="50%" y1="50%" x2="50%" y2="0" stroke="white" strokeWidth="2" />
                     <line x1="50%" y1="50%" x2="50%" y2="100%" stroke="white" strokeWidth="2" />
                     <line x1="50%" y1="50%" x2="0" y2="50%" stroke="white" strokeWidth="2" />
                     <line x1="50%" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="2" />
                  </svg>
              </div>

              {/* Center Core (Floating above plane) */}
              <div className="absolute z-10 transform translate-z-[50px]">
                 <div className="relative w-40 h-40 bg-slate-900/50 backdrop-blur-sm rounded-full border border-cyan-500/30 flex items-center justify-center shadow-[0_0_100px_rgba(6,182,212,0.2)]">
                     <CpuChipIcon className="w-20 h-20 text-white/80 animate-pulse" />
                     <div className="absolute inset-0 border-t border-cyan-500/50 rounded-full animate-spin"></div>
                 </div>
              </div>

           </div>
        </div>
      </div>
      
      {/* Nav */}
      <nav className="fixed top-0 w-full z-40 backdrop-blur-md border-b border-white/5 bg-[#030712]/80">
        <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="relative w-8 h-8 flex items-center justify-center">
              <CpuChipIcon className="relative w-6 h-6 text-cyan-400" />
              <div className="absolute inset-0 border border-cyan-500/30 rounded blur-[1px]"></div>
            </div>
            <span className="font-display font-bold text-lg tracking-[0.15em] text-white group-hover:text-cyan-400 transition-colors">CLARA</span>
          </div>
          
          <div className="hidden md:flex gap-10 text-[10px] text-slate-400 font-mono tracking-[0.2em]">
            <button onClick={() => document.getElementById('modules')?.scrollIntoView({behavior:'smooth'})} className="hover:text-cyan-400 transition-colors uppercase">Modules</button>
            <button onClick={() => document.getElementById('cases')?.scrollIntoView({behavior:'smooth'})} className="hover:text-cyan-400 transition-colors uppercase">Cases</button>
            <button onClick={() => document.getElementById('team')?.scrollIntoView({behavior:'smooth'})} className="hover:text-cyan-400 transition-colors uppercase">Team</button>
          </div>
          
          <button 
            onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}
            className="group relative px-5 py-2 overflow-hidden bg-white/5 border border-white/10 rounded hover:border-cyan-500/50 transition-all"
          >
            <div className="absolute inset-0 bg-cyan-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative font-bold text-[10px] font-mono tracking-widest text-cyan-400 group-hover:text-cyan-200">INITIALIZE</span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-[90vh] flex flex-col items-center justify-center text-center px-4 max-w-7xl mx-auto pt-20">
        
        <div className="inline-flex items-center gap-3 px-3 py-1 rounded-sm border-x border-cyan-500/30 bg-cyan-950/30 text-cyan-400 text-[10px] font-mono mb-8 backdrop-blur-md tracking-[0.2em] shadow-lg">
          <span>// SYSTEM OPERATIONAL</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
        </div>
        
        <h1 className="font-display text-5xl md:text-9xl font-black tracking-tighter mb-8 leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 drop-shadow-2xl">
          MEDICAL<br />
          INTELLIGENCE
        </h1>
        
        <p className="max-w-2xl text-slate-300 text-sm md:text-xl leading-relaxed mb-12 font-light tracking-wide drop-shadow-md bg-black/30 p-4 rounded-xl backdrop-blur-sm border border-white/5">
          Bridging the gap between global medical evidence and clinical decision-making with agentic precision.
        </p>

        <div className="flex flex-col md:flex-row gap-6 w-full md:w-auto">
          <button 
            onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}
            className="group relative px-10 py-5 bg-cyan-600 hover:bg-cyan-500 transition-all rounded-sm shadow-[0_0_30px_rgba(8,145,178,0.4)] hover:shadow-[0_0_60px_rgba(6,182,212,0.6)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <span className="relative font-bold tracking-widest text-xs flex items-center justify-center gap-2 text-white">
              ACCESS MODULES <ArrowRightIcon className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
          
          <button 
            onClick={() => document.getElementById('tech')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-10 py-5 border border-slate-600 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all rounded-sm font-bold tracking-widest text-xs bg-slate-900/80 backdrop-blur-md"
          >
             SYSTEM ARCHITECTURE
          </button>
        </div>
      </section>

      {/* Partners / Trust Section */}
      <section className="py-10 border-y border-slate-800/50 bg-[#02040a]/80 backdrop-blur-sm relative z-10">
         <div className="max-w-7xl mx-auto px-6">
            <p className="text-center text-[10px] font-mono tracking-[0.3em] text-slate-500 mb-8 uppercase">Strategic Partners & Technology Ecosystem</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
               <div className="flex items-center gap-2">
                  <GlobeAltIcon className="w-6 h-6" />
                  <span className="font-display font-bold text-lg">Google Developer Groups</span>
               </div>
               <div className="flex items-center gap-2">
                  <CodeBracketIcon className="w-6 h-6" />
                  <span className="font-display font-bold text-lg">HACKATHON 2025</span>
               </div>
            </div>
         </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="relative z-10 py-32 px-4 border-t border-slate-800/50 bg-[#030712]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-20">
            <div className="h-px flex-1 bg-slate-800"></div>
            <span className="font-display font-bold text-2xl md:text-4xl text-white">CORE MODULES</span>
            <div className="h-px flex-1 bg-slate-800"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
            
            {/* Research Card */}
            <div 
              onClick={() => onSelectModule('research', CONSTANTS.KEYS.RESEARCH)}
              className="tech-card group p-8 md:p-12 cursor-pointer h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-8">
                    <div className="w-16 h-16 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                        <BeakerIcon className="w-8 h-8 text-cyan-400 group-hover:text-white" />
                    </div>
                    <div className="text-[10px] font-mono text-cyan-500/50 border border-cyan-500/20 px-2 py-1">MOD_01</div>
                </div>

                <h3 className="font-display text-3xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors">RESEARCH</h3>
                <p className="text-slate-400 leading-relaxed mb-8 text-sm">
                   Autonomous RAG agent. Navigates PubMed & ClinicalTrials.gov to answer complex clinical queries with verified citations.
                </p>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-2 mb-8">
                  {['Guideline Synthesis', 'Drug Interactions', 'Protocol Check', 'Citation Map'].map((tag) => (
                    <div key={tag} className="px-3 py-2 border-l border-slate-700 bg-slate-900/30 text-slate-400 text-[10px] font-mono uppercase">
                      {tag}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 text-cyan-500 text-xs font-bold tracking-widest group-hover:gap-4 transition-all">
                  INITIALIZE <ArrowRightIcon className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Scribe Card */}
            <div 
              onClick={() => onSelectModule('scribe', CONSTANTS.KEYS.SCRIBE)}
              className="tech-card group p-8 md:p-12 cursor-pointer h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-8">
                    <div className="w-16 h-16 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                        <DocumentTextIcon className="w-8 h-8 text-purple-400 group-hover:text-white" />
                    </div>
                    <div className="text-[10px] font-mono text-purple-500/50 border border-purple-500/20 px-2 py-1">MOD_02</div>
                </div>

                <h3 className="font-display text-3xl font-bold mb-4 text-white group-hover:text-purple-400 transition-colors">SCRIBE</h3>
                <p className="text-slate-400 leading-relaxed mb-8 text-sm">
                  Ambient clinical intelligence. Listens, redacts PII instantly, and generates structured SOAP notes in FHIR format.
                </p>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-2 mb-8">
                  {['Real-time ASR', 'PII Redaction', 'FHIR Output', 'Multi-Speaker'].map((tag) => (
                    <div key={tag} className="px-3 py-2 border-l border-slate-700 bg-slate-900/30 text-slate-400 text-[10px] font-mono uppercase">
                      {tag}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 text-purple-500 text-xs font-bold tracking-widest group-hover:gap-4 transition-all">
                  INITIALIZE <ArrowRightIcon className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="cases" className="py-32 px-4 bg-[#050914] relative border-t border-slate-900">
         <div className="max-w-7xl mx-auto relative z-10">
            <h2 className="font-display text-2xl text-slate-500 font-bold mb-16 tracking-widest">DEPLOYMENT SCENARIOS</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Large Card */}
                <div className="md:col-span-2 glass-panel p-8 md:p-10 relative overflow-hidden group border-t border-cyan-500/20">
                    <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 group-hover:opacity-10 transition-opacity">
                        <AcademicCapIcon className="w-64 h-64 text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-cyan-500 font-mono text-xs mb-4">CASE STUDY: ONCOLOGY</div>
                        <h3 className="font-display text-2xl font-bold mb-4">Complex Case Review</h3>
                        <p className="text-slate-400 mb-8 max-w-lg text-sm leading-relaxed">
                            Dr. Linh uses CLARA to cross-reference a patient's rare mutation with Phase 3 trials. CLARA summarizes inclusion criteria and potential interactions.
                        </p>
                        <div className="inline-flex items-center gap-4 text-xs font-mono text-white">
                           <div className="px-3 py-1 bg-cyan-900/30 border border-cyan-700/50 rounded">85% FASTER REVIEW</div>
                           <div className="px-3 py-1 bg-cyan-900/30 border border-cyan-700/50 rounded">VERIFIED CITATIONS</div>
                        </div>
                    </div>
                </div>

                {/* Vertical Card */}
                <div className="md:row-span-2 glass-panel p-8 md:p-10 relative overflow-hidden group border-t border-purple-500/20 flex flex-col">
                    <div className="text-purple-500 font-mono text-xs mb-4">CASE STUDY: GENERAL PRACTICE</div>
                    <h3 className="font-display text-2xl font-bold mb-4">Automated Scribe</h3>
                    <p className="text-slate-400 mb-8 flex-1 text-sm leading-relaxed">
                        Dr. Nam activates CLARA Scribe. The system listens to the consultation in Vietnamese, filters small talk, and drafts a SOAP note.
                    </p>
                    <div className="mt-auto">
                        <div className="w-full h-32 bg-slate-900/50 rounded border border-white/5 relative overflow-hidden flex items-end justify-around pb-2 px-2">
                             {/* Fake Bar Chart */}
                             <div className="w-4 bg-purple-900/50 h-[40%]"></div>
                             <div className="w-4 bg-purple-900/50 h-[60%]"></div>
                             <div className="w-4 bg-purple-900/50 h-[30%]"></div>
                             <div className="w-4 bg-purple-500 h-[80%] shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                        </div>
                        <div className="text-center mt-2 text-[10px] text-slate-500 font-mono">DOCUMENTATION EFFICIENCY</div>
                    </div>
                </div>

                {/* Smaller Card */}
                <div className="glass-panel p-8 relative overflow-hidden group border-t border-blue-500/20">
                    <ShieldCheckIcon className="w-8 h-8 text-blue-500 mb-4" />
                    <h3 className="font-display text-lg font-bold mb-2">Education</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        Students use CLARA to simulate diagnostic reasoning, asking "Why?" for every protocol step.
                    </p>
                </div>

                 {/* Smaller Card */}
                <div className="glass-panel p-8 relative overflow-hidden group border-t border-emerald-500/20">
                    <BoltIcon className="w-8 h-8 text-emerald-500 mb-4" />
                    <h3 className="font-display text-lg font-bold mb-2">Decision Support</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        Real-time alerts for drug contraindications based on patient history.
                    </p>
                </div>
            </div>
         </div>
      </section>

      {/* TEAM SECTION */}
      <section id="team" className="py-32 relative z-10 border-t border-slate-900 bg-[#020617]">
          <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-end justify-between mb-16">
                  <h2 className="font-display text-3xl md:text-5xl font-bold text-white leading-none">
                      <span className="text-cyan-500 block text-lg font-mono mb-2 tracking-widest">THE ARCHITECTS</span>
                      HUMAN<br/>INTELLIGENCE
                  </h2>
                  <div className="hidden md:block w-32 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-cyan-500 animate-scan-vertical"></div>
                  </div>
              </div>

              <div className="glass-panel p-2 md:p-4 rounded-xl border border-cyan-500/20 max-w-6xl mx-auto relative group">
                  {/* Tech decorative corners */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50 -translate-x-1 -translate-y-1"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50 translate-x-1 -translate-y-1"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50 -translate-x-1 translate-y-1"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50 translate-x-1 translate-y-1"></div>

                  <div className="relative overflow-hidden rounded-lg aspect-[16/9] md:aspect-[21/9] bg-slate-900">
                      <img 
                          src="https://i.ibb.co/DPTm2SB7/image.jpg" 
                          onError={(e) => {
                            e.currentTarget.src = 'https://placehold.co/1200x600/020617/38bdf8?text=CLARA+TEAM&font=roboto';
                            e.currentTarget.onerror = null; // Prevent infinite loop
                          }}
                          alt="CLARA Team: Trinh Minh Quang, Vu Van An, Nguyen Ngoc Thien, Nguyen Hai Duy" 
                          className="w-full h-full object-cover opacity-100" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent opacity-90"></div>
                      
                      <div className="absolute bottom-0 left-0 w-full p-6 md:p-12">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                              {/* 1. Trinh Minh Quang */}
                              <div className="text-center md:text-left group/member">
                                  <div className="text-emerald-400 font-mono text-[10px] mb-2 tracking-widest border-b border-emerald-500/20 pb-1 inline-block">PRODUCT DESIGN</div>
                                  <div className="font-display font-bold text-base md:text-lg text-white group-hover/member:text-emerald-300 transition-colors">Trinh Minh Quang</div>
                              </div>
                              {/* 2. Vu Van An */}
                              <div className="text-center md:text-left group/member">
                                  <div className="text-purple-400 font-mono text-[10px] mb-2 tracking-widest border-b border-purple-500/20 pb-1 inline-block">AI RESEARCHER</div>
                                  <div className="font-display font-bold text-base md:text-lg text-white group-hover/member:text-purple-300 transition-colors">Vu Van An</div>
                              </div>
                              {/* 3. Nguyen Ngoc Thien */}
                              <div className="text-center md:text-left group/member">
                                  <div className="text-cyan-400 font-mono text-[10px] mb-2 tracking-widest border-b border-cyan-500/20 pb-1 inline-block">LEAD ENGINEER</div>
                                  <div className="font-display font-bold text-base md:text-lg text-white group-hover/member:text-cyan-300 transition-colors">Nguyen Ngoc Thien</div>
                              </div>
                              {/* 4. Nguyen Hai Duy */}
                              <div className="text-center md:text-left group/member">
                                  <div className="text-blue-400 font-mono text-[10px] mb-2 tracking-widest border-b border-blue-500/20 pb-1 inline-block">FULLSTACK DEV</div>
                                  <div className="font-display font-bold text-base md:text-lg text-white group-hover/member:text-blue-300 transition-colors">Nguyen Hai Duy</div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* Footer / Tech */}
      <section id="tech" className="py-20 bg-[#02040a] border-t border-slate-900 relative z-10">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="font-display text-xl font-bold mb-12 text-slate-600">SYSTEM ARCHITECTURE</h2>
            
            <div className="flex flex-wrap justify-center gap-4 md:gap-12 mb-20 opacity-70">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center bg-slate-900"><UserGroupIcon className="w-5 h-5 text-slate-400" /></div>
                    <span className="text-[10px] font-mono uppercase text-slate-500">Multimodal Input</span>
                </div>
                <div className="h-px w-8 bg-slate-800 self-center hidden md:block"></div>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full border border-cyan-900 flex items-center justify-center bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.2)]"><CpuChipIcon className="w-5 h-5 text-cyan-400" /></div>
                    <span className="text-[10px] font-mono uppercase text-cyan-500">Agentic Core</span>
                </div>
                <div className="h-px w-8 bg-slate-800 self-center hidden md:block"></div>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center bg-slate-900"><GlobeAltIcon className="w-5 h-5 text-slate-400" /></div>
                    <span className="text-[10px] font-mono uppercase text-slate-500">Evidence Vector DB</span>
                </div>
                <div className="h-px w-8 bg-slate-800 self-center hidden md:block"></div>
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center bg-slate-900"><DocumentTextIcon className="w-5 h-5 text-slate-400" /></div>
                    <span className="text-[10px] font-mono uppercase text-slate-500">FHIR Output</span>
                </div>
            </div>

            <div className="text-slate-600 text-xs font-mono">
               &copy; 2025 PROJECT CLARA. SECURE MEDICAL INTELLIGENCE.
            </div>
         </div>
      </section>
    </div>
  );
};

export default Landing;