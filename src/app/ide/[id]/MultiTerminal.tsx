'use client';

import { useState, useRef } from 'react';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

interface TerminalComponentProps {
  projectId: string;
  terminalId: string;
  onClose?: () => void;
  autoStartDevServer?: boolean;
}

const TerminalComponent = dynamic<TerminalComponentProps>(
  () => import('./TerminalComponent'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400">
        <div className="animate-pulse">Initializing terminal...</div>
      </div>
    )
  }
);

interface Terminal {
  id: string;
  name: string;
  autoStartDevServer?: boolean;
}

interface MultiTerminalProps {
  projectId: string;
}

export default function MultiTerminal({ projectId }: MultiTerminalProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: 'terminal-1', name: 'Terminal 1', autoStartDevServer: false }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState('terminal-1');
  const terminalCounterRef = useRef(1);

  const addTerminal = () => {
    terminalCounterRef.current += 1;
    const newTerminal: Terminal = {
      id: `terminal-${terminalCounterRef.current}`,
      name: `Terminal ${terminalCounterRef.current}`,
      autoStartDevServer: false
    };
    setTerminals([...terminals, newTerminal]);
    setActiveTerminalId(newTerminal.id);
  };

  const closeTerminal = (terminalId: string) => {
    if (terminals.length === 1) return; // Keep at least one terminal
    
    const newTerminals = terminals.filter(t => t.id !== terminalId);
    setTerminals(newTerminals);
    
    // If closing active terminal, switch to first available
    if (activeTerminalId === terminalId) {
      setActiveTerminalId(newTerminals[0].id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/90 via-black/95 to-slate-900/90 backdrop-blur-sm rounded-lg overflow-hidden border border-slate-800/50 shadow-2xl">
      {/* Terminal Tabs */}
      <div className="flex items-center gap-1 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b border-slate-700/50 px-2 py-1">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={cn(
                'group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all duration-200',
                activeTerminalId === terminal.id
                  ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/30 border border-green-500/50 shadow-lg shadow-green-500/20'
                  : 'bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/30'
              )}
              onClick={() => setActiveTerminalId(terminal.id)}
            >
              <div className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                activeTerminalId === terminal.id
                  ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50'
                  : 'bg-slate-600'
              )} />
              <TerminalIcon className={cn(
                'w-3.5 h-3.5 transition-colors',
                activeTerminalId === terminal.id ? 'text-green-400' : 'text-slate-500'
              )} />
              <span className={cn(
                'text-xs font-medium transition-colors',
                activeTerminalId === terminal.id ? 'text-slate-200' : 'text-slate-400'
              )}>
                {terminal.name}
              </span>
              {terminals.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(terminal.id);
                  }}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity ml-1',
                    'hover:bg-red-500/20 rounded p-0.5'
                  )}
                >
                  <X className="w-3 h-3 text-slate-400 hover:text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={addTerminal}
          className="h-7 px-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-500/30 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/30"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
        </Button>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-hidden relative">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-200',
              activeTerminalId === terminal.id ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            )}
          >
            <TerminalComponent 
              projectId={projectId} 
              terminalId={terminal.id}
              autoStartDevServer={terminal.autoStartDevServer}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
