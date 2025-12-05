'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';

interface TerminalComponentProps {
  projectId: string;
  terminalId: string;
  onClose?: () => void;
  autoStartDevServer?: boolean;
  isVisible?: boolean;
}

export default function TerminalComponent({ projectId, terminalId, autoStartDevServer = false, isVisible = true }: TerminalComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const currentCommandRef = useRef<string>('');
  const workingDirRef = useRef<string>('/app');
  const devServerProcessRef = useRef<boolean>(false);
  const projectMetadataRef = useRef<{ serverConfig?: { type?: string; port?: number } } | null>(null);

  // Fetch project metadata on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/metadata`);
        if (res.ok) {
          const data = await res.json();
          projectMetadataRef.current = data;
        }
      } catch (err) {
        console.error('Failed to fetch project metadata:', err);
      }
    };
    fetchMetadata();
  }, [projectId]);

  // Helper to get prompt with current directory
  const getPrompt = () => {
    let currentDir = workingDirRef.current;
    
    // Ensure we have a valid absolute path
    if (!currentDir || !currentDir.startsWith('/')) {
      currentDir = '/app';
      workingDirRef.current = currentDir;
    }
    
    // Format directory for display
    let displayDir = '~';
    if (currentDir === '/app') {
      displayDir = '~';
    } else if (currentDir.startsWith('/app/')) {
      displayDir = currentDir.replace('/app/', '');
    } else if (currentDir !== '/app') {
      displayDir = currentDir;
    }
    
    return `\x1b[1;32m➜\x1b[0m \x1b[1;36m${displayDir}\x1b[0m \x1b[1;90m$\x1b[0m `;
  };

  useEffect(() => {
    console.log('TerminalComponent mounted with projectId:', projectId, 'terminalId:', terminalId);
    
    if (!terminalRef.current) {
      console.log('terminalRef.current is null, waiting...');
      return;
    }
    
    if (terminalInstanceRef.current) {
      console.log('Terminal already initialized');
      return;
    }

    console.log('Initializing terminal...');
    
    try {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 14,
        fontFamily: '"Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
        fontWeight: '400',
        fontWeightBold: '700',
        lineHeight: 1.2,
        letterSpacing: 0,
        theme: {
          background: '#020617', // slate-950
          foreground: '#ffffff', // white for better visibility
          cursor: '#22d3ee', // cyan-400
          cursorAccent: '#020617',
          selectionBackground: '#3b82f680', // blue-500 with opacity
          selectionForeground: '#ffffff',
          black: '#1e293b',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#ffffff',
          brightBlack: '#475569',
          brightRed: '#f87171',
          brightGreen: '#34d399',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
        rows: 24,
        cols: 100,
        scrollback: 10000, // Larger scrollback buffer
        convertEol: true,
        allowProposedApi: true,
        smoothScrollDuration: 100,
        fastScrollModifier: 'shift',
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();
      
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.loadAddon(searchAddon);
      
      searchAddonRef.current = searchAddon;

      term.open(terminalRef.current);
      
      // Wait for next tick to ensure DOM is ready
      setTimeout(() => {
        try {
          fitAddon.fit();
          console.log('Terminal fitted successfully');
        } catch (err) {
          console.error('Error fitting terminal:', err);
        }
      }, 100);

      console.log('Terminal opened');
      
      // Enhanced welcome banner with gradients and modern styling
      term.writeln('\x1b[1;36m┌─────────────────────────────────────────────────────────┐\x1b[0m');
      term.writeln('\x1b[1;36m│\x1b[0m  \x1b[1;35m⚡ QuantumIDE Terminal\x1b[0m \x1b[1;90m─\x1b[0m \x1b[1;32mReady for Development\x1b[0m  \x1b[1;36m│\x1b[0m');
      term.writeln('\x1b[1;36m└─────────────────────────────────────────────────────────┘\x1b[0m');
      term.writeln('');
      
      // Display terminal info
      term.writeln(`\x1b[90m╭─ Terminal ID: \x1b[36m${terminalId}\x1b[0m`);
      term.writeln(`\x1b[90m├─ Shell: \x1b[33mbash\x1b[0m`);
      term.writeln(`\x1b[90m├─ Working Dir: \x1b[34m/app\x1b[0m`);
      term.writeln(`\x1b[90m╰─ Type '\x1b[36mhelp\x1b[90m' for available commands\x1b[0m`);
      term.writeln('');
      
      // Quick commands section with better formatting
      term.writeln('\x1b[1;33m📚 Quick Commands:\x1b[0m');
      term.writeln('  \x1b[1;32m▸\x1b[0m \x1b[36mls -la\x1b[0m               \x1b[90m─ List all files\x1b[0m');
      term.writeln('  \x1b[1;32m▸\x1b[0m \x1b[36mpwd\x1b[0m                  \x1b[90m─ Print working directory\x1b[0m');
      term.writeln('  \x1b[1;32m▸\x1b[0m \x1b[36mnpm install\x1b[0m          \x1b[90m─ Install dependencies\x1b[0m');
      term.writeln('  \x1b[1;32m▸\x1b[0m \x1b[36mnpm run dev\x1b[0m          \x1b[90m─ Start development server\x1b[0m');
      term.writeln('  \x1b[1;32m▸\x1b[0m \x1b[36mgit status\x1b[0m           \x1b[90m─ Check git status\x1b[0m');
      term.writeln('  \x1b[1;32m▸\x1b[0m \x1b[36mclear\x1b[0m                \x1b[90m─ Clear terminal\x1b[0m');
      term.writeln('');
      
      // Keyboard shortcuts
      term.writeln('\x1b[1;33m⌨️  Shortcuts:\x1b[0m');
      term.writeln('  \x1b[90m• \x1b[36m↑/↓\x1b[90m     Navigate command history\x1b[0m');
      term.writeln('  \x1b[90m• \x1b[36mTab\x1b[90m     Auto-complete (coming soon)\x1b[0m');
      term.writeln('  \x1b[90m• \x1b[36mCtrl+C\x1b[90m  Interrupt current process\x1b[0m');
      term.writeln('  \x1b[90m• \x1b[36mCtrl+L\x1b[90m  Clear screen\x1b[0m');
      term.writeln('');
      term.writeln('\x1b[90m' + '─'.repeat(60) + '\x1b[0m');
      term.writeln('');
      
      term.write(getPrompt());

      let currentCommand = '';
      let cursorPosition = 0;

      // Handle clear terminal event
      const handleClearTerminal = (event: CustomEvent) => {
        if (event.detail.terminalId === terminalId) {
          term.clear();
          term.write(getPrompt());
          currentCommand = '';
          cursorPosition = 0;
        }
      };
      
      window.addEventListener('clearTerminal', handleClearTerminal as EventListener);

      term.onData(async (data: string) => {
        // Handle escape sequences for arrow keys
        if (data === '\x1b[A') { // Up arrow - previous command
          if (commandHistoryRef.current.length > 0) {
            if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
              historyIndexRef.current++;
            }
            const historyCmd = commandHistoryRef.current[commandHistoryRef.current.length - 1 - historyIndexRef.current];
            
            // Clear current line
            term.write('\r\x1b[K' + getPrompt());
            term.write(historyCmd);
            currentCommand = historyCmd;
            cursorPosition = currentCommand.length;
          }
          return;
        }
        
        if (data === '\x1b[B') { // Down arrow - next command
          if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            const historyCmd = commandHistoryRef.current[commandHistoryRef.current.length - 1 - historyIndexRef.current];
            
            // Clear current line
            term.write('\r\x1b[K' + getPrompt());
            term.write(historyCmd);
            currentCommand = historyCmd;
            cursorPosition = currentCommand.length;
          } else if (historyIndexRef.current === 0) {
            historyIndexRef.current = -1;
            // Clear current line
            term.write('\r\x1b[K' + getPrompt());
            currentCommand = '';
            cursorPosition = 0;
          }
          return;
        }
        
        if (data === '\x1b[C') { // Right arrow
          if (cursorPosition < currentCommand.length) {
            term.write('\x1b[C');
            cursorPosition++;
          }
          return;
        }
        
        if (data === '\x1b[D') { // Left arrow
          if (cursorPosition > 0) {
            term.write('\x1b[D');
            cursorPosition--;
          }
          return;
        }
        
        // Ignore other escape sequences
        if (data.startsWith('\x1b')) {
          return;
        }
        
        if (data === '\r') {
          // Enter pressed - execute command
          term.write('\r\n');

          if (currentCommand.trim()) {
            let cmd = currentCommand.trim();
            
            // Add to command history
            if (commandHistoryRef.current[commandHistoryRef.current.length - 1] !== cmd) {
              commandHistoryRef.current.push(cmd);
              // Keep only last 100 commands
              if (commandHistoryRef.current.length > 100) {
                commandHistoryRef.current.shift();
              }
            }
            historyIndexRef.current = -1;
            
            // Handle built-in commands
            if (cmd === 'clear' || cmd === 'cls') {
              term.clear();
              currentCommand = '';
              cursorPosition = 0;
              term.write(getPrompt());
              return;
            }
            
            if (cmd === 'help') {
              term.writeln('\x1b[1;33mAvailable Commands:\x1b[0m');
              term.writeln('  \x1b[36mclear\x1b[0m          Clear terminal screen');
              term.writeln('  \x1b[36mhelp\x1b[0m           Show this help message');
              term.writeln('  \x1b[36mhistory\x1b[0m        Show command history');
              term.writeln('  \x1b[36mls\x1b[0m             List directory contents');
              term.writeln('  \x1b[36mpwd\x1b[0m            Print working directory');
              term.writeln('  \x1b[36mnpm\x1b[0m            Node package manager');
              term.writeln('  \x1b[36mgit\x1b[0m            Git version control');
              term.writeln('');
              currentCommand = '';
              cursorPosition = 0;
              term.write(getPrompt());
              return;
            }
            
            if (cmd === 'history') {
              commandHistoryRef.current.forEach((histCmd, idx) => {
                term.writeln(`  \x1b[90m${idx + 1}\x1b[0m  ${histCmd}`);
              });
              term.writeln('');
              currentCommand = '';
              cursorPosition = 0;
              term.write(getPrompt());
              return;
            }
            
            // Check if it's a dev server command
            const isDevServerCommand = cmd.includes('npm run dev') || cmd.includes('npm start') || 
                                      cmd.includes('vite') || cmd.includes('next dev');
            
            if (isDevServerCommand) {
              // Auto-add --host 0.0.0.0 for dev servers in Docker container
              // This is REQUIRED to expose the port outside the container
              if (!cmd.includes('--host') && !cmd.includes('-H')) {
                if (cmd.includes('npm run dev') || cmd.includes('npm start')) {
                  cmd = cmd + ' -- --host 0.0.0.0';
                  term.writeln(`\x1b[2;36m💡 Auto-added: -- --host 0.0.0.0 (required for Docker)\x1b[0m`);
                } else if (cmd.includes('vite')) {
                  cmd = cmd + ' --host 0.0.0.0';
                  term.writeln(`\x1b[2;36m💡 Auto-added: --host 0.0.0.0 (required for Docker)\x1b[0m`);
                }
              }
              
              // Execute dev server in background and open preview
              try {
                term.writeln('\x1b[32m🚀 Starting development server...\x1b[0m');
                devServerProcessRef.current = true;
                
                // Start dev server in background
                const startRes = await fetch(`/api/projects/${projectId}/start-background`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: cmd }),
                });
                
                const startResult = await startRes.json();
                
                if (startResult.success) {
                  term.writeln('\x1b[32m✓ Dev server started in background\x1b[0m');
                  
                  // Detect project type and port
                  const metadata = projectMetadataRef.current;
                  const projectType = metadata?.serverConfig?.type || 'vite';
                  const defaultPort = metadata?.serverConfig?.port || (projectType === 'nextjs' ? 3000 : 5173);
                  
                  term.writeln(`\x1b[36m📡 Server will be available at: http://localhost:${defaultPort}\x1b[0m`);
                  term.writeln('\x1b[90m💡 Waiting for server to start...\x1b[0m');
                  
                  // Wait a bit for server to start, then open preview
                  setTimeout(() => {
                    // Trigger preview window event
                    const previewEvent = new CustomEvent('openPreview', {
                      detail: { 
                        projectId, 
                        port: defaultPort,
                        projectType 
                      }
                    });
                    window.dispatchEvent(previewEvent);
                    term.writeln('\x1b[32m✓ Preview window opened\x1b[0m');
                  }, 3000);
                  
                } else {
                  term.writeln('\x1b[31m✗ Failed to start dev server\x1b[0m');
                  devServerProcessRef.current = false;
                }
              } catch (err) {
                console.error('Dev server start error:', err);
                term.writeln('\x1b[31m✗ Error starting dev server\x1b[0m');
                devServerProcessRef.current = false;
              }
            } else {
              // Regular command - execute normally
              try {
                const res = await fetch(`/api/projects/${projectId}/terminal`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: cmd }),
                });
                
                if (!res.ok) {
                  term.write('\x1b[31mError: Failed to execute command\x1b[0m\r\n');
                } else {
                  const result = await res.json();
                  
                  // Update working directory if returned and valid
                  if (result.workingDir && result.workingDir.startsWith('/')) {
                    workingDirRef.current = result.workingDir;
                  }
                  
                  // Write output or error
                  const output = result.output || result.error || '';
                  if (output) {
                    term.write(output);
                  }
                }
              } catch (err) {
                console.error('Terminal command error:', err);
                term.write('\x1b[31mError executing command\x1b[0m\r\n');
              }
            }
          }

          currentCommand = '';
          cursorPosition = 0;
          term.write(getPrompt());
        } else if (data === '\u007F') {
          // Backspace
          if (cursorPosition > 0) {
            // Remove character at cursor position
            currentCommand = currentCommand.slice(0, cursorPosition - 1) + currentCommand.slice(cursorPosition);
            cursorPosition--;
            
            // Redraw the line
            term.write('\r\x1b[K' + getPrompt());
            term.write(currentCommand);
            
            // Move cursor back to correct position
            const remaining = currentCommand.length - cursorPosition;
            if (remaining > 0) {
              term.write(`\x1b[${remaining}D`);
            }
          }
        } else if (data === '\u0003') {
          // Ctrl+C - Interrupt
          term.write('\x1b[31m^C\x1b[0m\r\n' + getPrompt());
          currentCommand = '';
          cursorPosition = 0;
        } else if (data === '\u000C') {
          // Ctrl+L - Clear screen
          term.clear();
          term.write(getPrompt());
          term.write(currentCommand);
          // Move cursor back to correct position
          const remaining = currentCommand.length - cursorPosition;
          if (remaining > 0) {
            term.write(`\x1b[${remaining}D`);
          }
        } else if (data.charCodeAt(0) < 32 && data !== '\r' && data !== '\n') {
          // Ignore other control characters
          return;
        } else {
          // Regular character - insert at cursor position
          currentCommand = currentCommand.slice(0, cursorPosition) + data + currentCommand.slice(cursorPosition);
          cursorPosition++;
          
          // Redraw from cursor position
          const rest = currentCommand.slice(cursorPosition - 1);
          term.write(rest);
          
          // Move cursor back if needed
          const toMove = rest.length - 1;
          if (toMove > 0) {
            term.write(`\x1b[${toMove}D`);
          }
        }
      });

      terminalInstanceRef.current = term;
      fitAddonRef.current = fitAddon;

      // Handle window resize
      const handleResize = () => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch (err) {
            console.error('Error on resize:', err);
          }
        }
      };
      
      window.addEventListener('resize', handleResize);

      return () => {
        console.log('Cleaning up terminal...');
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('clearTerminal', handleClearTerminal as EventListener);
        
        // Stop dev server if running
        if (devServerProcessRef.current) {
          fetch(`/api/projects/${projectId}/kill-process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ processName: 'node' }),
          }).catch(err => console.error('Error stopping dev server:', err));
        }
        
        term.dispose();
        terminalInstanceRef.current = null;
        fitAddonRef.current = null;
        searchAddonRef.current = null;
      };
    } catch (err) {
      console.error('Error initializing terminal:', err);
    }
  }, [projectId, terminalId, autoStartDevServer]);

  // Handle visibility changes for split terminals
  useEffect(() => {
    if (isVisible && fitAddonRef.current && terminalInstanceRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch (err) {
          console.error('Error fitting terminal on visibility change:', err);
        }
      }, 100);
    }
  }, [isVisible]);

  return (
    <div 
      className="h-full w-full bg-gradient-to-br from-slate-950 to-slate-900 relative" 
      style={{ 
        minHeight: '200px', 
        overflow: 'hidden'
      }}
    >
      {/* Terminal overlay effects - decorative only */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent pointer-events-none z-0" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none z-0" />
      
      {/* Terminal container - must be above overlays */}
      <div 
        ref={terminalRef} 
        className="relative z-10 h-full w-full"
        style={{ 
          padding: '12px',
        }}
      />
    </div>
  );
}
