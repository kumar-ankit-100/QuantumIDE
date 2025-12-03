'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Loader2, 
  Sparkles,
  Code2,
  Wand2,
  AlertCircle,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import DiffViewer from './DiffViewer';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  editSuggestion?: any; // The edit JSON from AI
}

interface FileEdit {
  path: string;
  originalContent: string;
  newContent: string;
  changes: any[];
  explanation: string;
}

interface CopilotChatProps {
  projectId: string;
  currentFile?: string;
  fileContent?: string;
  onFileUpdate?: (filePath: string, newContent: string) => Promise<void>;
}

export default function CopilotChat({ 
  projectId, 
  currentFile, 
  fileContent,
  onFileUpdate
}: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(`copilot-chat-${projectId}`);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, [projectId]);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`copilot-chat-${projectId}`, JSON.stringify(messages));
    }
  }, [messages, projectId]);

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

    try {
      // Check if this is a code edit request
      const isEditRequest = /\b(change|modify|update|add|create|refactor|fix|implement)\b/i.test(input);

      if (isEditRequest && currentFile && fileContent) {
        // Use the edit API for code modifications with streaming
        const response = await fetch('/api/ai/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input,
            currentFile,
            fileContent,
            projectId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI edit response');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';
        let editSuggestion = null;

        // Add initial assistant message for streaming
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: '',
            timestamp: new Date(),
          },
        ]);

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
                    streamedContent += parsed.content;
                    
                    // Update the streaming message
                    setMessages(prev => {
                      const lastMsg = prev[prev.length - 1];
                      if (lastMsg?.role === 'assistant') {
                        return [
                          ...prev.slice(0, -1),
                          { 
                            ...lastMsg, 
                            content: streamedContent 
                          },
                        ];
                      }
                      return prev;
                    });
                  }
                  
                  if (parsed.edit) {
                    editSuggestion = parsed.edit;
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        }

        // Update final message with edit suggestion
        if (editSuggestion) {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { 
                  ...lastMsg, 
                  content: editSuggestion.summary || 'I can help you with that!',
                  editSuggestion: editSuggestion,
                },
              ];
            }
            return prev;
          });
        }
      } else {
        // Use regular chat API for explanations
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            currentFile,
            fileContent,
            messages: [...messages, userMessage],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
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
                    
                    setMessages(prev => {
                      const lastMsg = prev[prev.length - 1];
                      if (lastMsg?.role === 'assistant' && !lastMsg.editSuggestion) {
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
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please make sure your API key is configured correctly.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptChanges = async (files: FileEdit[]) => {
    if (!onFileUpdate) {
      console.error('onFileUpdate callback not provided');
      return;
    }

    setApplyingChanges(true);
    
    try {
      // Apply all selected file changes
      for (const file of files) {
        await onFileUpdate(file.path, file.newContent);
      }

      // Add success message with file details
      const fileNames = files.map(f => f.path.split('/').pop()).join(', ');
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `✅ Successfully applied changes to ${files.length} file${files.length !== 1 ? 's' : ''}: ${fileNames}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Failed to apply changes:', error);
      
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: '❌ Failed to apply changes. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setApplyingChanges(false);
    }
  };

  const handleRejectChanges = () => {
    setMessages(prev => [
      ...prev,
      {
        role: 'system',
        content: '🔄 Changes discarded.',
        timestamp: new Date(),
      },
    ]);
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
      localStorage.removeItem(`copilot-chat-${projectId}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/60 to-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
            <Wand2 className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              AI Code Assistant
              <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
            </h3>
            <p className="text-xs text-slate-400">
              Ask me to modify, refactor, or explain your code
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearHistory}
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="w-full max-w-full">
          {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 p-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center"
            >
              <Sparkles className="w-10 h-10 text-purple-400" />
            </motion.div>
            
            <div className="space-y-3 max-w-md">
              <h3 className="text-lg font-semibold text-slate-200">
                AI-Powered Code Editing
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Tell me what you want to change, and I'll show you the diff with accept/reject options - just like GitHub Copilot!
              </p>
            </div>

            {currentFile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-300">Editing:</span>
                  <code className="text-purple-300 font-mono">
                    {currentFile.split('/').pop()}
                  </code>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 gap-2 w-full max-w-md mt-6">
              {[
                'Add a useState hook',
                'Refactor this function',
                'Add error handling',
                'Create a loading state'
              ].map((example, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  onClick={() => setInput(example)}
                  className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50 hover:border-purple-500/30 text-left text-sm text-slate-300 transition-all duration-200 hover:scale-105"
                >
                  💡 {example}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4 w-full">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex gap-3 w-full",
                    msg.role === 'user' ? 'justify-end' : 'justify-start',
                    msg.role === 'system' && 'justify-center'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className={cn(
                    "rounded-lg px-4 py-3 min-w-0 overflow-hidden",
                    msg.role === 'user' && "max-w-[85%] bg-gradient-to-r from-blue-600 to-blue-700 text-white",
                    msg.role === 'assistant' && "flex-1 bg-slate-800/80 text-slate-200 border border-slate-700/50",
                    msg.role === 'system' && msg.content.includes('✅') && "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-200 text-sm font-medium max-w-md",
                    msg.role === 'system' && msg.content.includes('❌') && "bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-200 text-sm font-medium max-w-md",
                    msg.role === 'system' && !msg.content.includes('✅') && !msg.content.includes('❌') && "bg-slate-900/50 text-slate-400 text-sm italic max-w-md border border-slate-700/30"
                  )}>
                    {msg.role === 'system' ? (
                      <div className="flex items-center gap-2">
                        {msg.content.includes('✅') ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 animate-in zoom-in" />
                        ) : msg.content.includes('❌') ? (
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 animate-in shake" />
                        ) : null}
                        <span className="break-words">{msg.content}</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm whitespace-pre-wrap break-words w-full overflow-hidden">
                          {msg.content}
                        </div>
                        <div className="mt-2 text-xs opacity-60">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-semibold">U</span>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Render DiffViewer for edit suggestions */}
              {messages.map((msg, idx) => (
                msg.editSuggestion && (
                  <motion.div
                    key={`diff-${idx}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-full mb-4"
                  >
                    <div className="w-full overflow-hidden">
                      <DiffViewer
                        edit={msg.editSuggestion}
                        onAccept={handleAcceptChanges}
                        onReject={handleRejectChanges}
                        isApplying={applyingChanges}
                      />
                    </div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </div>
        )}
        </div>
      </ScrollArea>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-slate-700/50 bg-slate-900/50 p-4">
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
              currentFile 
                ? "Tell me what to change in the code..." 
                : "Ask me anything about your project..."
            }
            className="flex-1 min-h-[60px] max-h-[120px] bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 resize-none focus:border-purple-500/50 transition-colors"
            disabled={isLoading || applyingChanges}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || applyingChanges}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all duration-200 shadow-lg hover:shadow-purple-500/50 hover:scale-105"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          <span>Use natural language: "Add a counter", "Refactor to use hooks", "Fix the error handling"</span>
        </p>
      </div>
    </div>
  );
}
