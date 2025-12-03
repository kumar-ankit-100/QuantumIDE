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
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ChatPanel from './ChatPanel';
import { ProjectLoading } from '@/components/editor/ProjectLoading';

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

  // Load file tree
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadFileTree(), loadPreviewUrl()]);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    
    // Poll for port updates every 1 second to catch when dev server starts/changes port
    const portCheckInterval = setInterval(() => {
      loadPreviewUrl();
    }, 1000);
    
    return () => clearInterval(portCheckInterval);
  }, [projectId]);

  const loadPreviewUrl = async () => {
    try {
      // Add timestamp to prevent caching
      const res = await fetch(`/api/projects/${projectId}/port?t=${Date.now()}`);
      const data = await res.json();
      console.log('Port info received:', data);
      if (data.previewUrl && data.hostPort) {
        console.log(`Updating preview URL to: ${data.previewUrl}`);
        setPreviewUrl(data.previewUrl);
        setHostPort(data.hostPort);
        setServerStarted(true);
      } else {
        console.log('No preview URL available:', data.error || 'No port found');
        setPreviewUrl('');
        setHostPort(null);
      }
    } catch (err) {
      console.error('Failed to load preview URL:', err);
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
    // Auto-save before going home
    if (selectedFile && fileContent) {
      await saveFile();
    }
    router.push('/');
  };

  const loadFileTree = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files/tree`);
      const data = await res.json();
      console.log('File tree response:', data);
      // The API returns a single root node with children
      const children = data.tree?.children || [];
      console.log('Setting file tree with', children.length, 'items');
      if (children.length > 0) {
        console.log('First file:', children[0]);
      }
      setFileTree(children);
    } catch (err) {
      console.error('Failed to load file tree:', err);
      setFileTree([]);
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
    if (!selectedFile) return;
    
    try {
      await fetch(`/api/projects/${projectId}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filePath: selectedFile, 
          content: fileContent 
        }),
      });
    } catch (err) {
      console.error('Failed to save file:', err);
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

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile === node.path;

      if (node.type === 'directory') {
        return (
          <div key={node.path} className="select-none">
            <div
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-200',
                'hover:bg-slate-800/50 hover:translate-x-1',
                isSelected && 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-l-2 border-blue-500'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => toggleFolder(node.path)}
            >
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-yellow-400 animate-in zoom-in duration-200" />
              ) : (
                <Folder className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-sm text-slate-300">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                {renderFileTree(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      return (
        <div
          key={node.path}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-200',
            'hover:bg-slate-800/50 hover:translate-x-1',
            isSelected && 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-l-2 border-blue-500'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => loadFile(node.path)}
        >
          <File className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-slate-300">{node.name}</span>
        </div>
      );
    });
  };

  // Show loading screen while files are loading
  if (loading) {
    return <ProjectLoading status="installing" message="Setting up your workspace..." />;
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
              disabled={!selectedFile}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 transition-all duration-300 hover:scale-105"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
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
              <div className="p-2">
                {loading ? (
                  <div className="text-sm text-slate-400 p-4 animate-pulse">Loading...</div>
                ) : fileTree.length === 0 ? (
                  <div className="text-sm text-slate-400 p-4">No files found</div>
                ) : (
                  renderFileTree(fileTree)
                )}
              </div>
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
                        disabled={!fileContent}
                        size="sm"
                        className="ml-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save
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
