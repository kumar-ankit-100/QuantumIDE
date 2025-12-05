'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Eye,
  Sparkles,
  RefreshCw,
  Code2,
  FileCode,
  X,
  FileText,
  ChevronDown,
  FolderTree,
  Search,
  Copy,
  Check,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import CopilotChat from '@/components/editor/CopilotChat';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ContextItem {
  type: 'file' | 'selection' | 'codebase';
  content: string;
  fileName?: string;
  lineRange?: string;
  fileCount?: number;
}

interface FileItem {
  name: string;
  path: string;
  content?: string;
}

interface ChatPanelProps {
  projectId: string;
  currentFile?: string;
  fileContent?: string;
  selectedText?: string;
  selectedLineRange?: string;
  previewUrl?: string;
  hostPort?: number | null;
  onFileUpdate?: (filePath: string, newContent: string) => Promise<void>;
}

type TabType = 'preview' | 'chat' | 'copilot';

// Code block component with copy functionality
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-900/50 w-full">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/50 sticky top-0 z-10">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {language || 'code'}
        </span>
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs transition-all duration-200 hover:scale-105"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code content - scrollable with visible scrollbar */}
      <div className="overflow-x-auto overflow-y-auto max-h-[400px] bg-slate-950/50">
        <pre className="p-4 text-sm font-mono leading-relaxed">
          <code className="text-slate-200 break-all whitespace-pre-wrap">{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Function to parse markdown-style code blocks and format message
function MessageContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(
        <div key={`text-${lastIndex}`} className="prose prose-invert prose-sm max-w-none">
          {formatText(text)}
        </div>
      );
    }

    // Add code block
    const language = match[1] || 'code';
    const code = match[2].trim();
    parts.push(<CodeBlock key={`code-${match.index}`} code={code} language={language} />);

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    parts.push(
      <div key={`text-${lastIndex}`} className="prose prose-invert prose-sm max-w-none">
        {formatText(text)}
      </div>
    );
  }

  return <div className="space-y-3 w-full max-w-full overflow-hidden">{parts.length > 0 ? parts : formatText(content)}</div>;
}

// Format text with inline code, bold, lists, etc.
function formatText(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (currentList.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`} className="my-2 ml-4 space-y-1">
          {currentList}
        </ListTag>
      );
      currentList = [];
      listType = null;
    }
  };

  lines.forEach((line, idx) => {
    // Handle numbered lists
    if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      currentList.push(
        <li key={idx} className="text-slate-300">
          {formatInlineContent(line.replace(/^\d+\.\s/, ''))}
        </li>
      );
    }
    // Handle bullet lists
    else if (/^[*-]\s/.test(line)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      currentList.push(
        <li key={idx} className="text-slate-300">
          {formatInlineContent(line.replace(/^[*-]\s/, ''))}
        </li>
      );
    }
    // Handle headings
    else if (line.startsWith('**') && line.endsWith('**')) {
      flushList();
      elements.push(
        <h3 key={idx} className="font-semibold text-slate-100 mt-3 mb-2">
          {line.replace(/\*\*/g, '')}
        </h3>
      );
    }
    // Regular paragraph
    else if (line.trim()) {
      flushList();
      elements.push(
        <p key={idx} className="text-slate-300 leading-relaxed break-words">
          {formatInlineContent(line)}
        </p>
      );
    }
    // Empty line
    else {
      flushList();
      elements.push(<br key={idx} />);
    }
  });

  flushList();
  return elements;
}

// Format inline content (code, bold, italic)
function formatInlineContent(text: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Match inline code `code`
  const inlineCodeRegex = /`([^`]+)`/g;
  let match;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    // Add text before code
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add inline code
    parts.push(
      <code
        key={match.index}
        className="px-1.5 py-0.5 rounded bg-slate-800/80 text-purple-300 font-mono text-xs border border-slate-700/50"
      >
        {match[1]}
      </code>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export default function ChatPanel({ 
  projectId, 
  currentFile, 
  fileContent,
  selectedText,
  selectedLineRange,
  previewUrl,
  hostPort,
  onFileUpdate
}: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('copilot'); // Default to copilot tab
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load available files when context menu opens
  useEffect(() => {
    if (showContextMenu && availableFiles.length === 0) {
      loadAvailableFiles();
    }
  }, [showContextMenu]);

  const loadAvailableFiles = async () => {
    setLoadingFiles(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files/tree`);
      const data = await response.json();
      
      console.log('File tree API response:', data);
      
      // Flatten the file tree to get all files
      const flattenFiles = (nodes: any[]): FileItem[] => {
        let files: FileItem[] = [];
        
        // Check if nodes is actually an array
        if (!Array.isArray(nodes)) {
          console.warn('nodes is not an array:', nodes);
          return files;
        }
        
        for (const node of nodes) {
          if (node.type === 'file') {
            files.push({
              name: node.name,
              path: node.path,
            });
          } else if (node.type === 'directory' && node.children) {
            files = files.concat(flattenFiles(node.children));
          }
        }
        return files;
      };
      
      // The API returns { tree: { children: [...] } }
      let files: FileItem[] = [];
      if (data.tree && data.tree.children) {
        files = flattenFiles(data.tree.children);
      } else if (data.tree && Array.isArray(data.tree)) {
        files = flattenFiles(data.tree);
      } else if (Array.isArray(data)) {
        files = flattenFiles(data);
      }
      
      console.log('Loaded files:', files.length, files);
      setAvailableFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
      setAvailableFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const addFileContext = async (filePath?: string) => {
    const targetFile = filePath || currentFile;
    const targetContent = filePath ? await loadFileContent(filePath) : fileContent;
    
    if (targetFile && targetContent) {
      const fileName = targetFile.split('/').pop() || targetFile;
      const exists = contextItems.some(
        item => item.type === 'file' && item.fileName === fileName
      );
      
      if (!exists) {
        setContextItems(prev => [
          ...prev,
          {
            type: 'file',
            content: targetContent,
            fileName,
          }
        ]);
      }
      setShowContextMenu(false);
    }
  };

  const loadFileContent = async (filePath: string): Promise<string> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const data = await response.json();
      return data.content || '';
    } catch (error) {
      console.error('Failed to load file:', error);
      return '';
    }
  };

  const addCodebaseContext = async () => {
    setLoadingFiles(true);
    try {
      // Load all files (limit to reasonable size)
      const filesToLoad = availableFiles.slice(0, 20); // Limit to prevent overwhelming the AI
      const fileContents = await Promise.all(
        filesToLoad.map(async (file) => {
          const content = await loadFileContent(file.path);
          return `// File: ${file.path}\n${content}`;
        })
      );
      
      const codebaseContent = fileContents.join('\n\n');
      
      setContextItems(prev => [
        ...prev.filter(item => item.type !== 'codebase'),
        {
          type: 'codebase',
          content: codebaseContent,
          fileCount: filesToLoad.length,
        }
      ]);
      setShowContextMenu(false);
    } catch (error) {
      console.error('Failed to load codebase:', error);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Auto-switch to preview tab when preview URL becomes available
  useEffect(() => {
    if (previewUrl && activeTab !== 'preview') {
      console.log('Auto-switching to preview tab, URL:', previewUrl);
      setActiveTab('preview');
    }
  }, [previewUrl]);

  // Auto-add selected text as context when it changes
  useEffect(() => {
    if (selectedText && selectedText.trim()) {
      const fileName = currentFile?.split('/').pop() || 'file';
      const existingSelection = contextItems.find(item => item.type === 'selection');
      
      if (!existingSelection) {
        setContextItems(prev => [
          ...prev.filter(item => item.type !== 'selection'),
          {
            type: 'selection',
            content: selectedText,
            fileName,
            lineRange: selectedLineRange,
          }
        ]);
      } else if (existingSelection.content !== selectedText) {
        setContextItems(prev => [
          ...prev.filter(item => item.type !== 'selection'),
          {
            type: 'selection',
            content: selectedText,
            fileName,
            lineRange: selectedLineRange,
          }
        ]);
      }
    }
  }, [selectedText, selectedLineRange, currentFile]);

  const removeContext = (index: number) => {
    setContextItems(prev => prev.filter((_, i) => i !== index));
  };

  // Filter files based on search query
  const filteredFiles = availableFiles.filter(file =>
    file.name.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
    file.path.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Build enhanced context with context items
    let enhancedFileContent = fileContent || '';
    let enhancedPrompt = input;

    if (contextItems.length > 0) {
      let contextString = '\n\n--- Context ---\n';
      contextItems.forEach(item => {
        if (item.type === 'selection') {
          contextString += `\nSelected code from ${item.fileName}${item.lineRange ? ` (lines ${item.lineRange})` : ''}:\n\`\`\`\n${item.content}\n\`\`\`\n`;
        } else if (item.type === 'file') {
          contextString += `\nFull file: ${item.fileName}\n\`\`\`\n${item.content}\n\`\`\`\n`;
        }
      });
      enhancedPrompt = contextString + '\n\n' + input;
    }

    try {
      const response = await fetch(`/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          currentFile,
          fileContent: enhancedFileContent,
          messages: [...messages, { ...userMessage, content: enhancedPrompt }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API error:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  aiResponse += parsed.content;
                  
                  // Update the last message or add new one
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === 'assistant') {
                      return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, content: aiResponse },
                      ];
                    } else {
                      return [
                        ...prev,
                        {
                          role: 'assistant',
                          content: aiResponse,
                          timestamp: new Date(),
                        },
                      ];
                    }
                  });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPreview = () => {
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-900/80 backdrop-blur-sm rounded-lg overflow-hidden border border-slate-800/50 shadow-2xl transition-all duration-300 hover:border-purple-500/30">
      {/* Tab Header - Fixed at top */}
      <div className="flex-shrink-0 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/60 to-slate-900/60 flex items-center sticky top-0 z-50">
        <button
          onClick={() => setActiveTab('preview')}
          className={cn(
            'flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all duration-200 border-b-2',
            activeTab === 'preview'
              ? 'border-purple-500 bg-slate-800/50 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
          )}
        >
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">Preview</span>
          {hostPort && (
            <span className="text-xs text-slate-500 px-2 py-0.5 rounded bg-slate-800/50">
              :{hostPort}
            </span>
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('copilot')}
          className={cn(
            'flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all duration-200 border-b-2',
            activeTab === 'copilot'
              ? 'border-purple-500 bg-slate-800/50 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
          )}
        >
          <Wand2 className="w-4 h-4" />
          <span className="text-sm font-medium">AI Copilot</span>
          <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all duration-200 border-b-2',
            activeTab === 'chat'
              ? 'border-blue-500 bg-slate-800/50 text-blue-300'
              : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
          )}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm font-medium">AI Chat</span>
        </button>
      </div>

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 flex items-center justify-between bg-gradient-to-r from-slate-800/60 to-slate-900/60 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse shadow-lg shadow-purple-500/50"></div>
              <span className="text-sm font-medium text-slate-300">Live Preview</span>
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
                    <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                  </div>
                  <p className="mb-4 font-medium text-lg text-slate-300">Starting Dev Server...</p>
                  <div className="space-y-3 text-sm">
                    <p className="font-medium text-slate-400">Waiting for server to start</p>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                      <span>This may take up to 30 seconds</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                      Run <code className="text-green-400 bg-slate-950/80 px-2 py-1 rounded">npm run dev</code> in the terminal if not started
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Copilot Tab - NEW! */}
      {activeTab === 'copilot' && (
        <div className="flex-1 overflow-hidden min-h-0">
          <CopilotChat
            projectId={projectId}
            currentFile={currentFile}
            fileContent={fileContent}
            onFileUpdate={onFileUpdate}
          />
        </div>
      )}

      {/* AI Chat Tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-blue-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-200">AI Coding Assistant</h3>
                  <p className="text-sm text-slate-400 max-w-xs">
                    Ask questions about your code, request refactoring, or get suggestions
                  </p>
                </div>
                {currentFile && (
                  <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Code2 className="w-3 h-3" />
                      <span>Current file: {currentFile.split('/').pop()}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 pb-4 w-full">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex gap-3 animate-in slide-in-from-bottom-2 w-full',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        'rounded-lg px-4 py-3 min-w-0',
                        msg.role === 'user'
                          ? 'max-w-[85%] bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                          : 'flex-1 bg-slate-800/80 text-slate-200 border border-slate-700/50'
                      )}
                    >
                      <div className="text-sm w-full overflow-hidden">
                        {msg.role === 'user' ? (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        ) : (
                          <div className="w-full overflow-hidden">
                            <MessageContent content={msg.content} />
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-xs opacity-60 flex items-center gap-2">
                        <span>{msg.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                    
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">U</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-slate-700/50 bg-slate-900/50">
            {/* Context Items */}
            {contextItems.length > 0 && (
              <div className="px-4 pt-3 pb-2 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span className="text-xs font-medium text-slate-400">Active Context</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contextItems.map((item, index) => (
                    <div
                      key={index}
                      className="group relative animate-in slide-in-from-left duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 hover:border-purple-500/50 transition-all duration-200">
                        {item.type === 'selection' ? (
                          <>
                            <Code2 className="w-3 h-3 text-purple-400" />
                            <span className="text-xs text-slate-300 font-medium">
                              {item.fileName}
                              {item.lineRange && (
                                <span className="text-slate-500 ml-1">:{item.lineRange}</span>
                              )}
                            </span>
                            <span className="text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-800/50">
                              {item.content.split('\n').length} lines
                            </span>
                          </>
                        ) : item.type === 'codebase' ? (
                          <>
                            <FolderTree className="w-3 h-3 text-green-400" />
                            <span className="text-xs text-slate-300 font-medium">
                              Entire Codebase
                            </span>
                            <span className="text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-800/50">
                              {item.fileCount} files
                            </span>
                          </>
                        ) : (
                          <>
                            <FileCode className="w-3 h-3 text-blue-400" />
                            <span className="text-xs text-slate-300 font-medium">
                              {item.fileName}
                            </span>
                            <span className="text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-800/50">
                              full file
                            </span>
                          </>
                        )}
                        <button
                          onClick={() => removeContext(index)}
                          className="ml-1 p-0.5 rounded hover:bg-red-500/20 transition-colors"
                        >
                          <X className="w-3 h-3 text-slate-400 hover:text-red-400" />
                        </button>
                      </div>
                      
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="max-w-md p-2 rounded-lg bg-slate-800 border border-slate-700 shadow-xl">
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-32 overflow-auto">
                            {item.type === 'codebase' 
                              ? `Includes ${item.fileCount} files from the project`
                              : item.content.slice(0, 200)}
                            {item.content.length > 200 && item.type !== 'codebase' && '...'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Context Button */}
            <div className="px-4 pt-2 pb-2">
              <div className="relative">
                <button
                  onClick={() => setShowContextMenu(!showContextMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-200 text-xs text-slate-400 hover:text-slate-300"
                >
                  <FileText className="w-3 h-3" />
                  <span>Add file context</span>
                  <ChevronDown className={cn(
                    "w-3 h-3 transition-transform duration-200",
                    showContextMenu && "rotate-180"
                  )} />
                </button>

                {/* Context Menu */}
                {showContextMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg bg-slate-800 border border-slate-700 shadow-xl animate-in slide-in-from-bottom-2 duration-200 z-50 overflow-hidden">
                    {/* Quick Actions */}
                    <div className="p-2 space-y-1 border-b border-slate-700/50">
                      <button
                        onClick={() => addFileContext()}
                        disabled={!currentFile || !fileContent}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-700/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileCode className="w-4 h-4 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-300 truncate">
                            {currentFile ? currentFile.split('/').pop() : 'No file selected'}
                          </div>
                          <div className="text-xs text-slate-500">
                            Add current file
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={addCodebaseContext}
                        disabled={loadingFiles}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-700/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FolderTree className="w-4 h-4 text-green-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-300">
                            Entire Codebase
                          </div>
                          <div className="text-xs text-slate-500">
                            {loadingFiles ? 'Loading...' : `Add all files (up to 20)`}
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Search and File List */}
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                        <Input
                          type="text"
                          placeholder="Search files..."
                          value={fileSearchQuery}
                          onChange={(e) => setFileSearchQuery(e.target.value)}
                          className="pl-7 h-8 text-xs bg-slate-900/50 border-slate-700/50 text-slate-300 placeholder:text-slate-500"
                        />
                      </div>

                      {loadingFiles ? (
                        <div className="py-8 text-center">
                          <Loader2 className="w-5 h-5 mx-auto text-purple-400 animate-spin" />
                          <p className="text-xs text-slate-500 mt-2">Loading files...</p>
                        </div>
                      ) : (
                        <ScrollArea className="h-64">
                          <div className="space-y-1">
                            {filteredFiles.length > 0 ? (
                              filteredFiles.map((file, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => addFileContext(file.path)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-700/50 transition-colors text-left group"
                                >
                                  <FileText className="w-3 h-3 text-slate-400 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs text-slate-300 truncate">
                                      {file.name}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                      {file.path}
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="py-8 text-center">
                                <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                                <p className="text-xs text-slate-500">
                                  {fileSearchQuery ? 'No files found' : 'No files available'}
                                </p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Box */}
            <div className="p-4 pt-2">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    contextItems.length > 0 
                      ? "Ask about the selected code..."
                      : currentFile 
                        ? `Ask about ${currentFile.split('/').pop()}...` 
                        : "Ask AI anything..."
                  }
                  className="flex-1 min-h-[60px] max-h-[120px] bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 resize-none focus:border-purple-500/50 transition-colors"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg hover:shadow-purple-500/50 hover:scale-105"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                <span>Press Enter to send • Shift+Enter for new line</span>
                {contextItems.length > 0 && (
                  <span className="text-purple-400">• {contextItems.length} context item{contextItems.length > 1 ? 's' : ''}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
