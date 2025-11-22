import React, { useState } from 'react';
import Landing from './components/Landing';
import ChatInterface from './components/ChatInterface';
import { AppState } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentView: 'landing',
    apiKey: null
  });

  const handleSelectModule = (mode: 'research' | 'scribe', key: string) => {
    setState({
      currentView: mode,
      apiKey: key
    });
  };

  const handleExit = () => {
    setState({
      currentView: 'landing',
      apiKey: null
    });
  };

  return (
    <main className="w-full min-h-screen bg-[#020617]">
      {state.currentView === 'landing' && (
        <Landing onSelectModule={handleSelectModule} />
      )}
      
      {state.currentView === 'research' && state.apiKey && (
        <ChatInterface 
          mode="research" 
          apiKey={state.apiKey} 
          onExit={handleExit} 
        />
      )}

      {state.currentView === 'scribe' && state.apiKey && (
        <ChatInterface 
          mode="scribe" 
          apiKey={state.apiKey} 
          onExit={handleExit} 
        />
      )}
    </main>
  );
};

export default App;