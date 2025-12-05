'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import dynamic from 'next/dynamic';
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from '@/components/ui/resizable';
import { 
  File, 
  Folder, 
  FolderOpen,
  Code2,
  Code,
  Save,
  Home,
  Play,
  Github,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Plus,
  FilePlus,
  FolderPlus,
  Loader2,
  Check
} from 'lucide-react';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ChatPanel from './ChatPanel';
import { ProjectLoading } from '@/components/editor/ProjectLoading';
import { GitHubStatus } from '@/components/editor/GitHubStatus';
import FileExplorer from '@/components/editor/FileExplorer';

// Define the props type
interface MultiTerminalProps {
  projectId: string;
}

// Dynamically import MultiTerminal component to avoid SSR issues
const MultiTerminal = dynamic<MultiTerminalProps>(
  () => import('./MultiTerminal'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400">
        <div className="animate-pulse">Loading terminals...</div>
      </div>
    )
  }
);

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export default function IDEPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hostPort, setHostPort] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectedLineRange, setSelectedLineRange] = useState<string>('');
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverStarted, setServerStarted] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isFileSaving, setIsFileSaving] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Note: Container cleanup only happens when user explicitly clicks home button
  // This prevents accidental cleanup on page refresh or browser navigation

  // Listen for preview open events from terminal
  useEffect(() => {
    const handleOpenPreview = (event: CustomEvent) => {
      console.log('Preview open event received:', event.detail);
      const { port, projectType } = event.detail;
      
      // Immediately load the preview URL
      loadPreviewUrl();
      
      // Poll aggressively for a longer time to catch the server starting
      let pollCount = 0;
      const maxPolls = 30; // 30 seconds - dev servers can take time to start
      const pollInterval = setInterval(async () => {
        await loadPreviewUrl();
        pollCount++;
        
        if (previewUrl || pollCount >= maxPolls) {
          clearInterval(pollInterval);
          if (previewUrl) {
            console.log('Preview loaded successfully:', previewUrl);
          } else {
            console.warn('Preview polling timed out after 30 seconds');
          }
        }
      }, 1000);
    };

    window.addEventListener('openPreview', handleOpenPreview as EventListener);
    return () => window.removeEventListener('openPreview', handleOpenPreview as EventListener);
  }, [previewUrl]);

  // Load file tree and metadata
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Try to load file tree first
        const treeResult = await loadFileTree();
        
        // If loading failed (likely because container doesn't exist), try to resume project
        if (!treeResult) {
          console.log('Container not found, attempting to resume project from GitHub...');
          setIsResuming(true);
          try {
            const resumeRes = await fetch(`/api/projects/${projectId}/resume`, {
              method: 'POST',
            });
            
            if (resumeRes.ok) {
              console.log('Project resumed successfully, retrying data load...');
              // Wait a moment for container to be ready, then retry
              await new Promise(resolve => setTimeout(resolve, 3000));
              await Promise.all([loadFileTree(), loadPreviewUrl()]);
              setIsResuming(false);
            } else {
              const errorText = await resumeRes.text();
              console.error('Failed to resume project:', errorText);
              setIsResuming(false);
            }
          } catch (resumeErr) {
            console.error('Error resuming project:', resumeErr);
            setIsResuming(false);
          }
        } else {
          // Container exists, load preview URL
          await loadPreviewUrl();
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    
    // Poll for port updates every 3 seconds to catch when dev server starts
    // Only poll if server hasn't started yet
    const portCheckInterval = setInterval(() => {
      if (!serverStarted) {
        loadPreviewUrl();
      }
    }, 3000);
    
    return () => clearInterval(portCheckInterval);
  }, [projectId]);

  const loadPreviewUrl = async () => {
    try {
      // Add timestamp to prevent caching
      const res = await fetch(`/api/projects/${projectId}/port?t=${Date.now()}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        
        // Check if container needs recreation due to missing port mappings
        if (errorData.needsRecreation) {
          console.warn('Container has no port mappings, recreating...');
          
          // Recreate container with proper port mappings
          const recreateRes = await fetch(`/api/projects/${projectId}/recreate`, {
            method: 'POST'
          });
          
          if (recreateRes.ok) {
            console.log('Container recreated successfully, retrying preview load...');
            // Wait a moment then retry
            setTimeout(() => loadPreviewUrl(), 2000);
          } else {
            console.error('Failed to recreate container');
          }
        }
        
        return;
      }
      
      const data = await res.json();
      if (data.previewUrl && data.hostPort) {
        setPreviewUrl(data.previewUrl);
        setHostPort(data.hostPort);
        setServerStarted(true);
      } else {
        setPreviewUrl('');
        setHostPort(null);
      }
    } catch (err) {
      // Silently fail - container might not exist yet
      setPreviewUrl('');
      setHostPort(null);
    }
  };



  const startDevServer = async () => {
    setIsStartingServer(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/start`, {
        method: 'POST',
      });
      
      if (res.ok) {
        // Poll for port after starting
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          await loadPreviewUrl();
          attempts++;
          if (previewUrl || attempts > 30) {
            clearInterval(pollInterval);
            setIsStartingServer(false);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to start dev server:', err);
      setIsStartingServer(false);
    }
  };

  const goHome = async () => {
    // Prevent multiple cleanup calls
    if (isCleaningUp) {
      return;
    }
    
    setIsCleaningUp(true);
    
    try {
      // Save current file before leaving
      if (selectedFile && fileContent) {
        await saveFile();
      }
      
      // Cleanup container before leaving
      await fetch(`/api/projects/${projectId}/cleanup`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to cleanup container:', err);
    } finally {
      // Navigate to home regardless of cleanup success
      router.push('/');
    }
  };

  const saveToGitHub = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // Save current file first if one is open
      if (selectedFile && fileContent) {
        await saveFile();
      }

      // Call autosave API to commit and push
      const res = await fetch('/api/projects/autosave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
        }),
      });

      if (res.ok) {
        setSaveStatus('success');
        setLastSaved(new Date());
        console.log('Successfully saved to GitHub');
        
        // Reset status after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } else if (res.status === 500) {
        // Check if container doesn't exist
        const error = await res.json();
        console.error('Failed to save to GitHub:', error);
        
        if (error.containerNotFound || (error.error && error.error.includes('no such container'))) {
          console.log('Container missing, attempting to resume project...');
          setSaveStatus('idle'); // Clear saving status
          setLoading(true); // Show loading indicator
          
          // Try to resume project
          const resumeRes = await fetch(`/api/projects/${projectId}/resume`, {
            method: 'POST',
          });
          
          if (resumeRes.ok) {
            console.log('Project resumed, reloading page...');
            // Wait for container to be ready
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Reload the page to reconnect to the new container
            window.location.reload();
            return;
          } else {
            console.error('Failed to resume project');
            setLoading(false);
          }
        }
        
        setSaveStatus('error');
        setTimeout(() => {
          setSaveStatus('idle');
        }, 5000);
      } else {
        const error = await res.json();
        console.error('Failed to save to GitHub:', error);
        setSaveStatus('error');
        
        // Reset status after 5 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 5000);
      }
    } catch (err) {
      console.error('Error saving to GitHub:', err);
      setSaveStatus('error');
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const loadFileTree = async (): Promise<boolean> => {
    try {
      console.log('[IDE] Loading file tree for project:', projectId);
      const res = await fetch(`/api/projects/${projectId}/files/tree`);
      
      if (!res.ok) {
        console.error('[IDE] Failed to load file tree, status:', res.status);
        const errorData = await res.json();
        console.error('[IDE] Error details:', errorData);
        setFileTree([]);
        return false;
      }
      
      const data = await res.json();
      console.log('[IDE] File tree response:', data);
      // The API returns a single root node with children
      const children = data.tree?.children || [];
      console.log('[IDE] Setting file tree with', children.length, 'items');
      if (children.length > 0) {
        console.log('[IDE] First file:', children[0]);
      }
      setFileTree(children);
      return true;
    } catch (err) {
      console.error('[IDE] Failed to load file tree:', err);
      setFileTree([]);
      return false;
    }
  };

  const loadFile = async (path: string) => {
    try {
      console.log('Loading file:', path);
      const res = await fetch(`/api/projects/${projectId}/files/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path }),
      });
      const data = await res.json();
      console.log('File content loaded:', data.content?.substring(0, 100));
      setFileContent(data.content || '');
      setSelectedFile(path);
    } catch (err) {
      console.error('Failed to load file:', err);
    }
  };

  const saveFile = async () => {
    if (!selectedFile || isFileSaving) return;
    
    setIsFileSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filePath: selectedFile, 
          content: fileContent 
        }),
      });
      
      // Show success briefly
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsFileSaving(false);
    }
  };

  const createNewItem = async () => {
    if (!newItemName.trim()) return;
    
    try {
      const path = contextMenuFolder ? `${contextMenuFolder}/${newItemName}` : newItemName;
      await fetch(`/api/projects/${projectId}/files/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, type: createType }),
      });
      
      // Reload file tree
      await loadFileTree();
      
      // If it's a file, open it
      if (createType === 'file') {
        await loadFile(path);
      }
      
      // Reset dialog
      setShowCreateDialog(false);
      setNewItemName('');
      setContextMenuFolder('');
    } catch (err) {
      console.error('Failed to create item:', err);
    }
  };

  // Handler for AI Copilot file updates
  const handleFileUpdate = async (filePath: string, newContent: string) => {
    try {
      await fetch(`/api/projects/${projectId}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filePath, 
          content: newContent 
        }),
      });
      
      // If updating the currently open file, refresh it
      if (filePath === selectedFile) {
        setFileContent(newContent);
      }
      
      // Optionally reload file tree to show any new files
      await loadFileTree();
    } catch (err) {
      console.error('Failed to update file:', err);
      throw err; // Re-throw so CopilotChat can handle the error
    }
  };

  const refreshPreview = () => {
    // Reload preview URL
    loadPreviewUrl();
    // Also refresh iframe if it exists
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Show loading screen while files are loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center space-y-6 max-w-md mx-auto px-6">
          {/* Animated Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/50 animate-bounce">
                <Code2 className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          {/* Loading Text */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {isResuming ? 'Resuming Your Project' : 'Loading Workspace'}
            </h2>
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">
                {isResuming 
                  ? 'Cloning from GitHub and installing dependencies...'
                  : 'Setting up your development environment...'
                }
              </p>
              {isResuming && (
                <p className="text-slate-500 text-xs">
                  This may take 1-2 minutes for the first load
                </p>
              )}
            </div>
          </div>

          {/* Loading Animation */}
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Connecting to container...</span>
            </div>
            {isResuming && (
              <>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-700"></div>
                  <span>Running npm install...</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-700"></div>
                  <span>Starting development server...</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header with gradient */}
      <div className="border-b border-slate-800/50 bg-gradient-to-r from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={goHome}
              className="hover:bg-slate-800/50 transition-all duration-200"
            >
              <Home className="w-5 h-5 text-slate-400 hover:text-blue-400 transition-colors" />
            </Button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              QuantumIDE
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <GitHubStatus 
              projectId={projectId}
              onManualSave={saveToGitHub}
              isSaving={isSaving}
              lastSaved={lastSaved}
              saveStatus={saveStatus}
            />
            
            <div className="h-6 w-px bg-slate-700" />
            
            <div className="flex gap-2">
              {!serverStarted && (
                <Button 
                  size="sm" 
                  onClick={startDevServer}
                  disabled={isStartingServer}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0 transition-all duration-300 hover:scale-105"
                >
                  {isStartingServer ? (
                    <>
                      <Code2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Server
                    </>
                  )}
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={saveFile} 
                disabled={!selectedFile || isFileSaving}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                {isFileSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save File
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Explorer */}
        <ResizablePanel defaultSize={20} minSize={15}>
          <div className="h-full flex flex-col border-r border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/50">
            <div className="border-b border-slate-800/50 px-4 py-3 font-semibold text-sm bg-slate-900/50">
              <span className="text-slate-300">Files</span>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="text-sm text-slate-400 p-4 space-y-2">
                  <div className="animate-pulse flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isResuming ? 'Resuming project from GitHub...' : 'Loading...'}
                  </div>
                  {isResuming && (
                    <div className="text-xs text-slate-500">
                      This may take a minute while dependencies are installed
                    </div>
                  )}
                </div>
              ) : fileTree.length === 0 ? (
                <div className="text-sm text-slate-400 p-4">No files found</div>
              ) : (
                <FileExplorer
                  fileTree={fileTree}
                  selectedFile={selectedFile}
                  expandedFolders={expandedFolders}
                  projectId={projectId}
                  onFileSelect={loadFile}
                  onToggleFolder={toggleFolder}
                  onRefreshTree={loadFileTree}
                />
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Editor + Preview */}
        <ResizablePanel defaultSize={50}>
          <ResizablePanelGroup direction="vertical">
            {/* Code Editor */}
            <ResizablePanel defaultSize={70}>
              <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-900/80 backdrop-blur-sm rounded-lg overflow-hidden border border-slate-800/50 shadow-2xl transition-all duration-300 hover:border-blue-500/30">
                {selectedFile ? (
                  <>
                    <div className="border-b border-slate-700/50 px-4 py-2 text-sm font-medium bg-gradient-to-r from-slate-800/60 to-slate-900/60 flex items-center gap-2">
                      <Code className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-300">{selectedFile.split('/').pop()}</span>
                      <Button
                        onClick={saveFile}
                        disabled={!fileContent || isFileSaving}
                        size="sm"
                        className="ml-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50"
                      >
                        {isFileSaving ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <Editor
                        height="100%"
                        language="typescript"
                        theme="vs-dark"
                        value={fileContent}
                        onChange={(value) => setFileContent(value || '')}
                        onMount={(editor) => {
                          // Track text selection
                          editor.onDidChangeCursorSelection((e) => {
                            const selection = editor.getModel()?.getValueInRange(e.selection);
                            if (selection && selection.trim()) {
                              setSelectedText(selection);
                              const startLine = e.selection.startLineNumber;
                              const endLine = e.selection.endLineNumber;
                              setSelectedLineRange(
                                startLine === endLine 
                                  ? `${startLine}` 
                                  : `${startLine}-${endLine}`
                              );
                            } else {
                              setSelectedText('');
                              setSelectedLineRange('');
                            }
                          });
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          wordWrap: 'on',
                          // Disable all validation/linting
                          'semanticHighlighting.enabled': false,
                        }}
                        beforeMount={(monaco) => {
                          // Disable all diagnostics/validation
                          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                            noSemanticValidation: true,
                            noSyntaxValidation: true,
                            noSuggestionDiagnostics: true,
                          });
                          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                            noSemanticValidation: true,
                            noSyntaxValidation: true,
                            noSuggestionDiagnostics: true,
                          });
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4 p-8 rounded-xl bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/30">
                      <Code2 className="w-16 h-16 mx-auto text-slate-600 animate-pulse" />
                      <p className="text-slate-400 text-lg font-medium">Select a file to edit</p>
                      <p className="text-slate-500 text-sm">Choose a file from the explorer to start coding</p>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Terminal */}
            <ResizablePanel defaultSize={30} minSize={20}>
              <MultiTerminal projectId={projectId} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Preview & AI Chat Panel */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <ChatPanel 
            projectId={projectId}
            currentFile={selectedFile}
            fileContent={fileContent}
            selectedText={selectedText}
            selectedLineRange={selectedLineRange}
            previewUrl={previewUrl}
            hostPort={hostPort}
            onFileUpdate={handleFileUpdate}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
