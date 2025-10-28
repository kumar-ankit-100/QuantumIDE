'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  RefreshCw,
  Code2,
  Code,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
  const projectId = params.id as string;
  
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hostPort, setHostPort] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header with gradient */}
      <div className="border-b border-slate-800/50 bg-gradient-to-r from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              QuantumIDE
            </h1>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={saveFile} 
              disabled={!selectedFile}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 transition-all duration-300 hover:scale-105"
            >
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

        {/* Preview */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-900/80 backdrop-blur-sm rounded-lg overflow-hidden border border-slate-800/50 shadow-2xl transition-all duration-300 hover:border-purple-500/30">
            <div className="border-b border-slate-700/50 px-4 py-2 flex items-center justify-between bg-gradient-to-r from-slate-800/60 to-slate-900/60">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse shadow-lg shadow-purple-500/50"></div>
                <span className="text-sm font-medium text-slate-300">Preview</span>
                {hostPort && (
                  <span className="text-xs text-slate-500 px-2 py-0.5 rounded bg-slate-800/50">
                    :{hostPort}
                  </span>
                )}
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={refreshPreview}
                className="hover:bg-slate-800/50 transition-all duration-200 hover:scale-110"
              >
                <RefreshCw className="w-4 h-4 text-purple-400" />
              </Button>
            </div>
            <div className="flex-1 bg-white rounded-b-lg overflow-hidden">
              {previewUrl ? (
                <iframe
                  key={previewUrl} 
                  id="preview-iframe"
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Preview"
                  onError={(e) => {
                    console.error('Iframe failed to load:', e);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-900/50 to-slate-950/50 p-8 text-center">
                  <div className="space-y-4 max-w-md p-8 rounded-xl bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/30">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-purple-400 animate-spin-slow" />
                    </div>
                    <p className="mb-4 font-medium text-lg text-slate-300">Preview Not Available</p>
                    <div className="space-y-3 text-sm">
                      <p className="font-medium text-slate-400">Start the dev server with:</p>
                      <code className="block bg-slate-950/80 px-4 py-3 rounded-lg text-left font-mono text-green-400 border border-slate-700/50">
                        npm run dev -- --host 0.0.0.0
                      </code>
                      <p className="text-xs text-slate-500 mt-4">
                        The <code className="text-purple-400">--host 0.0.0.0</code> flag allows the server to be accessible from outside the container
                      </p>
                      <Button 
                        onClick={refreshPreview} 
                        variant="outline" 
                        size="sm"
                        className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 transition-all duration-200 shadow-lg hover:shadow-purple-500/50"
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Try Refresh
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
