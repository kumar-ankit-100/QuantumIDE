'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalComponentProps {
  projectId: string;
  terminalId: string;
  onClose?: () => void;
  autoStartDevServer?: boolean;
}

export default function TerminalComponent({ projectId, terminalId, autoStartDevServer = false }: TerminalComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const devServerProcessRef = useRef<boolean>(false);
  const logStreamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const projectMetadataRef = useRef<{ serverConfig?: { type?: string } } | null>(null);

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

  // Cleanup function to stop dev server
  const stopDevServer = async () => {
    // Clear log streaming interval
    if (logStreamIntervalRef.current) {
      clearInterval(logStreamIntervalRef.current);
      logStreamIntervalRef.current = null;
    }
    
    if (devServerProcessRef.current) {
      try {
        console.log('Stopping dev server...');
        await fetch(`/api/projects/${projectId}/kill-process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ processName: 'vite' }),
        });
        devServerProcessRef.current = false;
        console.log('Dev server stopped');
      } catch (err) {
        console.error('Error stopping dev server:', err);
      }
    }
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
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#0f172a', // slate-900
          foreground: '#cbd5e1', // slate-300
          cursor: '#22d3ee', // cyan-400
          selectionBackground: '#1e40af66', // blue-700 with opacity
        },
        rows: 20,
        cols: 80,
        scrollback: 1000, // Enable scrollback buffer
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

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
      
      term.writeln('\x1b[1;36m╔════════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[1;36m║  \x1b[1;35m⚡ QuantumIDE Terminal Ready\x1b[1;36m       ║\x1b[0m');
      term.writeln('\x1b[1;36m╚════════════════════════════════════════╝\x1b[0m');
      term.writeln('');
      term.writeln('\x1b[1;33m📁 Quick Commands:\x1b[0m');
      term.writeln('  \x1b[1;32m→\x1b[0m \x1b[36mls\x1b[0m                  List files');
      term.writeln('  \x1b[1;32m→\x1b[0m \x1b[36mnpm run dev -- --host 0.0.0.0\x1b[0m');
      term.writeln('                        Start dev server');
      term.writeln('  \x1b[1;32m→\x1b[0m \x1b[36mtail -f /tmp/dev-server.log\x1b[0m');
      term.writeln('                        View dev server logs');
      term.writeln('  \x1b[1;32m→\x1b[0m \x1b[36mnpm install <pkg>\x1b[0m   Install packages');
      term.writeln('');
      
      term.write('\x1b[1;35m$\x1b[0m ');

      let currentCommand = '';
      let inEscapeSequence = false;

      term.onData(async (data: string) => {
        // Handle escape sequences (arrow keys, etc.)
        if (data === '\x1b') {
          inEscapeSequence = true;
          return;
        }
        
        if (inEscapeSequence) {
          // Ignore escape sequence characters
          if (data === '[' || (data >= 'A' && data <= 'Z') || (data >= '0' && data <= '9') || data === '~') {
            if (data >= 'A' && data <= 'Z' || data === '~') {
              inEscapeSequence = false;
            }
            return;
          }
          inEscapeSequence = false;
        }
        
        if (data === '\r') {
          // Enter pressed - execute command
          term.write('\r\n');

          if (currentCommand.trim()) {
            let cmd = currentCommand.trim();
            
            // Auto-add --host 0.0.0.0 ONLY for Vite projects, not Next.js
            // Next.js already has -H 0.0.0.0 configured in package.json
            const serverType = projectMetadataRef.current?.serverConfig?.type || 'vite';
            const isNextJS = serverType === 'nextjs';
            
            if (!isNextJS && (cmd === 'npm run dev' || cmd === 'vite')) {
              cmd = cmd + ' -- --host 0.0.0.0';
              term.writeln(`\x1b[2m(Auto-added: -- --host 0.0.0.0)\x1b[0m`);
            }
            
            // Check if it's a dev server command
            if (cmd.includes('npm run dev') || cmd.includes('vite')) {
              try {
                // First, stop any existing dev server
                if (devServerProcessRef.current) {
                  term.writeln('\x1b[33mStopping existing dev server...\x1b[0m');
                  await fetch(`/api/projects/${projectId}/kill-process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ processName: 'vite' }),
                  });
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                devServerProcessRef.current = true;
                
                // Start in background
                const startRes = await fetch(`/api/projects/${projectId}/start-background`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: cmd }),
                });
                
                const startResult = await startRes.json();
                
                if (startResult.success) {
                  // Stream logs CONTINUOUSLY from the log file
                  let lastPosition = 0;
                  
                  const streamLogs = async () => {
                    try {
                      const logsRes = await fetch(`/api/projects/${projectId}/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          command: `tail -c +${lastPosition + 1} /tmp/dev-server.log 2>/dev/null || echo ""` 
                        }),
                      });
                      
                      const logsData = await logsRes.json();
                      if (logsData.output && logsData.output.trim()) {
                        term.write(logsData.output);
                        lastPosition += logsData.output.length;
                      }
                    } catch (err) {
                      console.error('Error streaming logs:', err);
                    }
                  };
                  
                  // Clear any existing interval
                  if (logStreamIntervalRef.current) {
                    clearInterval(logStreamIntervalRef.current);
                  }
                  
                  // Stream logs every 500ms FOREVER (until stopped)
                  setTimeout(streamLogs, 500); // First check after 500ms
                  logStreamIntervalRef.current = setInterval(streamLogs, 500);
                } else {
                  term.write('\x1b[1;31mFailed to start dev server\x1b[0m\r\n');
                }
              } catch (err) {
                term.write('\x1b[1;31mError executing command\x1b[0m\r\n');
              }
            } else {
              // Regular command - execute normally
              try {
                const res = await fetch(`/api/projects/${projectId}/terminal`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: currentCommand }),
                });
                const result = await res.json();
                term.write(result.output || result.error || '');
              } catch (err) {
                term.write('Error executing command\r\n');
              }
            }
          }

          currentCommand = '';
          term.write('\x1b[1;35m$\x1b[0m ');
        } else if (data === '\u007F') {
          // Backspace
          if (currentCommand.length > 0) {
            currentCommand = currentCommand.slice(0, -1);
            term.write('\b \b');
          }
        } else if (data === '\u0003') {
          // Ctrl+C - Stop log streaming if active
          if (logStreamIntervalRef.current) {
            clearInterval(logStreamIntervalRef.current);
            logStreamIntervalRef.current = null;
          }
          term.write('^C\r\n\x1b[1;35m$\x1b[0m ');
          currentCommand = '';
        } else if (data.charCodeAt(0) < 32 && data !== '\r' && data !== '\n') {
          // Ignore other control characters (including arrow keys, escape sequences, etc.)
          // Don't add them to the command buffer
          return;
        } else {
          // Regular character
          currentCommand += data;
          term.write(data);
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
        stopDevServer(); // Stop dev server when terminal is unmounted
        term.dispose();
        terminalInstanceRef.current = null;
        fitAddonRef.current = null;
      };
    } catch (err) {
      console.error('Error initializing terminal:', err);
    }
  }, [projectId, terminalId, autoStartDevServer]);

  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full" 
      style={{ 
        minHeight: '200px', 
        padding: '8px',
        overflow: 'auto'
      }}
    />
  );
}
