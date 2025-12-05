'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Plus, X, Terminal as TerminalIcon, Trash2, 
  Maximize2, Minimize2, Search, Copy, Settings,
  Download, Play, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

interface TerminalComponentProps {
  projectId: string;
  terminalId: string;
  onClose?: () => void;
  autoStartDevServer?: boolean;
  isVisible?: boolean;
}

const TerminalComponent = dynamic<TerminalComponentProps>(
  () => import('./TerminalComponent'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-950 to-slate-900 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <div className="text-sm font-medium">Initializing terminal...</div>
        </div>
      </div>
    )
  }
);

interface Terminal {
  id: string;
  name: string;
  autoStartDevServer?: boolean;
  isRunning?: boolean;
  splitWith?: string; // ID of terminal to split with
}

interface MultiTerminalProps {
  projectId: string;
}

export default function MultiTerminal({ projectId }: MultiTerminalProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: 'terminal-1', name: 'bash', autoStartDevServer: false, isRunning: true }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState('terminal-1');
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const terminalCounterRef = useRef(1);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+` - Toggle maximize
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setIsMaximized(!isMaximized);
      }
      // Ctrl+Shift+` - New terminal
      if (e.ctrlKey && e.shiftKey && e.key === '~') {
        e.preventDefault();
        addTerminal();
      }
      // Ctrl+Shift+F - Search in terminal
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowSearch(!showSearch);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, showSearch]);

  const addTerminal = (shellType: string = 'bash') => {
    terminalCounterRef.current += 1;
    const newTerminal: Terminal = {
      id: `terminal-${terminalCounterRef.current}`,
      name: shellType,
      autoStartDevServer: false,
      isRunning: true
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

  const killTerminal = (terminalId: string) => {
    setTerminals(terminals.map(t => 
      t.id === terminalId ? { ...t, isRunning: false } : t
    ));
  };

  const renameTerminal = (terminalId: string, newName: string) => {
    setTerminals(terminals.map(t => 
      t.id === terminalId ? { ...t, name: newName } : t
    ));
  };

  const clearTerminal = async (terminalId: string) => {
    // This will be handled by the TerminalComponent
    const event = new CustomEvent('clearTerminal', { detail: { terminalId } });
    window.dispatchEvent(event);
  };

  const getShellIcon = (name: string) => {
    return '🐚';
  };

  return (
    <div className={cn(
      "h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl",
      "border border-slate-800/60",
      isMaximized && "fixed inset-4 z-50"
    )}>
      {/* Enhanced Terminal Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 border-b border-slate-700/50 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-1">
          {/* Terminal Tabs with Scroll */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-2xl custom-scrollbar">
            {terminals.map((terminal) => (
              <div
                key={terminal.id}
                className={cn(
                  'group relative flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 select-none',
                  activeTerminalId === terminal.id
                    ? 'bg-gradient-to-br from-cyan-600/25 via-blue-600/25 to-purple-600/25 border border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/30 hover:border-slate-600/50'
                )}
                onClick={() => setActiveTerminalId(terminal.id)}
              >
                {/* Status Indicator */}
                <div className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  terminal.isRunning
                    ? activeTerminalId === terminal.id
                      ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-500/50'
                      : 'bg-green-500'
                    : 'bg-red-500'
                )} />
                
                {/* Shell Icon */}
                <span className="text-sm">{getShellIcon(terminal.name)}</span>
                
                {/* Terminal Name */}
                <span className={cn(
                  'text-xs font-medium transition-colors whitespace-nowrap',
                  activeTerminalId === terminal.id ? 'text-slate-100' : 'text-slate-400'
                )}>
                  {terminal.name}
                </span>
                
                {/* Close Button */}
                {terminals.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTerminal(terminal.id);
                    }}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 transition-all ml-1',
                      'hover:bg-red-500/20 rounded-md p-0.5 hover:scale-110'
                    )}
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-red-400" />
                  </button>
                )}
                
                {/* Running Indicator */}
                {terminal.isRunning && activeTerminalId === terminal.id && (
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* New Terminal Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => addTerminal('bash')}
              title="New Terminal"
              className="h-7 px-2 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 hover:from-emerald-600/30 hover:to-cyan-600/30 border border-emerald-500/30 transition-all duration-200 hover:scale-105"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
            </Button>

            {/* Search */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSearch(!showSearch)}
              title="Search Terminal (Ctrl+Shift+F)"
              className={cn(
                "h-7 px-2 transition-all duration-200 hover:scale-105",
                showSearch
                  ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/50"
                  : "bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/30"
              )}
            >
              <Search className={cn(
                "w-3.5 h-3.5",
                showSearch ? "text-blue-400" : "text-slate-400"
              )} />
            </Button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          {/* Terminal Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/30"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-700" align="end">
              <DropdownMenuItem onClick={() => clearTerminal(activeTerminalId)} className="cursor-pointer">
                <Trash2 className="w-4 h-4 mr-2" /> Clear Terminal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => killTerminal(activeTerminalId)} className="cursor-pointer">
                <Square className="w-4 h-4 mr-2" /> Kill Terminal
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem className="cursor-pointer">
                <Copy className="w-4 h-4 mr-2" /> Copy Selection
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Download className="w-4 h-4 mr-2" /> Export Logs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Maximize Toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsMaximized(!isMaximized)}
            title="Toggle Maximize (Ctrl+`)"
            className="h-7 px-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/30"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            )}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
          <Search className="w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terminal output..."
            className="flex-1 h-7 bg-slate-800 border-slate-700 text-slate-200 text-sm"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSearch(false)}
            className="h-7 px-2"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>
      )}

      {/* Keyboard Shortcuts Info */}
      <div className="flex items-center gap-4 px-3 py-1 bg-slate-900/60 border-b border-slate-800/50 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Ctrl+Shift+`</kbd>
          New Terminal
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Ctrl+`</kbd>
          Maximize
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Ctrl+Shift+F</kbd>
          Search
        </span>
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
              isVisible={activeTerminalId === terminal.id}
            />
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gradient-to-r from-slate-900/95 to-slate-800/95 border-t border-slate-700/50 text-xs">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1">
            <TerminalIcon className="w-3 h-3" />
            {terminals.length} {terminals.length === 1 ? 'Terminal' : 'Terminals'}
          </span>
          <span className="flex items-center gap-1">
            <Play className="w-3 h-3 text-green-400" />
            {terminals.filter(t => t.isRunning).length} Running
          </span>
        </div>
        <div className="text-slate-500">
          <span>Shell: {terminals.find(t => t.id === activeTerminalId)?.name || 'bash'}</span>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(15 23 42 / 0.5);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(71 85 105 / 0.5);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(100 116 139 / 0.7);
        }
      `}</style>
    </div>
  );
}
