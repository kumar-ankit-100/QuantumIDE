'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  FileCode, 
  Sparkles,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface FileChange {
  type: 'add' | 'modify' | 'delete';
  description: string;
  startLine: number;
  endLine: number;
}

interface FileEdit {
  path: string;
  originalContent: string;
  newContent: string;
  changes: FileChange[];
  explanation: string;
}

interface DiffViewerProps {
  edit: {
    action: 'edit' | 'create' | 'explain';
    files: FileEdit[];
    summary: string;
  };
  onAccept: (files: FileEdit[]) => Promise<void>;
  onReject: () => void;
  isApplying?: boolean;
}

export default function DiffViewer({ edit, onAccept, onReject, isApplying = false }: DiffViewerProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set([0])); // First file expanded by default
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(
    new Set(edit.files.map((_, idx) => idx)) // All files selected by default
  );

  console.log('DiffViewer rendered:', { edit, filesCount: edit.files.length });

  const toggleFile = (index: number) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleFileSelection = (index: number) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAccept = async () => {
    const filesToApply = edit.files.filter((_, idx) => selectedFiles.has(idx));
    await onAccept(filesToApply);
  };

  // Generate line-by-line diff
  const generateDiff = (original: string, updated: string) => {
    const originalLines = original.split('\n');
    const updatedLines = updated.split('\n');
    const diff: Array<{ type: 'add' | 'remove' | 'same'; line: string; lineNumber: number }> = [];

    // Simple diff algorithm (for better diff, use diff library)
    const maxLength = Math.max(originalLines.length, updatedLines.length);
    let originalIdx = 0;
    let updatedIdx = 0;

    while (originalIdx < originalLines.length || updatedIdx < updatedLines.length) {
      const origLine = originalLines[originalIdx];
      const updLine = updatedLines[updatedIdx];

      if (origLine === updLine) {
        diff.push({ type: 'same', line: origLine, lineNumber: originalIdx + 1 });
        originalIdx++;
        updatedIdx++;
      } else {
        // Check if line was removed
        if (originalIdx < originalLines.length && !updatedLines.includes(origLine)) {
          diff.push({ type: 'remove', line: origLine, lineNumber: originalIdx + 1 });
          originalIdx++;
        }
        // Check if line was added
        else if (updatedIdx < updatedLines.length && !originalLines.includes(updLine)) {
          diff.push({ type: 'add', line: updLine, lineNumber: updatedIdx + 1 });
          updatedIdx++;
        } else {
          // Modified line
          if (originalIdx < originalLines.length) {
            diff.push({ type: 'remove', line: origLine, lineNumber: originalIdx + 1 });
            originalIdx++;
          }
          if (updatedIdx < updatedLines.length) {
            diff.push({ type: 'add', line: updLine, lineNumber: updatedIdx + 1 });
            updatedIdx++;
          }
        }
      }
    }

    return diff;
  };

  if (edit.action === 'explain') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <AlertCircle className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-200 mb-2">Information</h4>
            <p className="text-sm text-slate-300">{edit.summary}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReject}
            className="hover:bg-slate-800/50"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-lg overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 border border-purple-500/30 shadow-2xl shadow-purple-500/10 w-full"
    >
      {/* Header - Fixed */}
      <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-b border-purple-500/30">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
            <div className="p-2 rounded-lg bg-purple-500/20 backdrop-blur-sm flex-shrink-0">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <h3 className="text-sm font-semibold text-slate-200 truncate">
                AI Suggested Changes
              </h3>
              <p className="text-xs text-slate-400 truncate">{edit.summary}</p>
            </div>
          </div>
          
          <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300 flex-shrink-0">
            {edit.files.length} file{edit.files.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* File Changes - No max height, parent ScrollArea handles scrolling */}
      <div className="w-full max-h-[500px] overflow-y-auto overflow-x-hidden">
        {edit.files.map((file, fileIdx) => {
          const isExpanded = expandedFiles.has(fileIdx);
          const isSelected = selectedFiles.has(fileIdx);
          const diff = generateDiff(file.originalContent, file.newContent);

          return (
            <motion.div
              key={fileIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: fileIdx * 0.1 }}
              className="border-b border-slate-700/50 last:border-b-0"
            >
              {/* File Header */}
              <div
                className={cn(
                  "px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors min-w-0",
                  isSelected ? "bg-slate-800/50 hover:bg-slate-800/70" : "bg-slate-900/30 hover:bg-slate-800/50"
                )}
                onClick={() => toggleFile(fileIdx)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleFileSelection(fileIdx);
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900 flex-shrink-0"
                  />
                  
                  <FileCode className={cn(
                    "w-4 h-4 flex-shrink-0",
                    edit.action === 'create' ? "text-green-400" : "text-blue-400"
                  )} />
                  
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-200 truncate flex-1 min-w-0">
                        {file.path}
                      </span>
                      {edit.action === 'create' && (
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-300 flex-shrink-0">
                          New
                        </Badge>
                      )}
                    </div>
                    {file.explanation && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {file.explanation}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    {file.changes.length} change{file.changes.length !== 1 ? 's' : ''}
                  </Badge>
                  
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Changes List */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {/* Change Descriptions */}
                    <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700/30">
                      <div className="space-y-2">
                        {file.changes.map((change, changeIdx) => (
                          <div
                            key={changeIdx}
                            className="flex items-start gap-2 text-xs flex-wrap"
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                "mt-0.5 flex-shrink-0",
                                change.type === 'add' && "border-green-500/30 text-green-300",
                                change.type === 'modify' && "border-blue-500/30 text-blue-300",
                                change.type === 'delete' && "border-red-500/30 text-red-300"
                              )}
                            >
                              {change.type}
                            </Badge>
                            <span className="text-slate-400 flex-shrink-0">
                              Line {change.startLine}
                              {change.endLine !== change.startLine && `-${change.endLine}`}:
                            </span>
                            <span className="text-slate-300 break-words">{change.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Diff View - Scrollable Code Section */}
                    <div className="bg-slate-950/50 border-t border-slate-700/30">
                      <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                        <div className="font-mono text-xs min-w-max">
                          {diff.map((line, lineIdx) => (
                            <div
                              key={lineIdx}
                              className={cn(
                                "flex items-start min-w-0 transition-colors duration-150",
                                line.type === 'add' && "bg-green-900/30 hover:bg-green-900/40 border-l-4 border-green-500",
                                line.type === 'remove' && "bg-red-900/30 hover:bg-red-900/40 border-l-4 border-red-500",
                                line.type === 'same' && "bg-slate-900/20 hover:bg-slate-900/30"
                              )}
                            >
                              <span className="w-14 flex-shrink-0 px-2 py-1.5 text-slate-500 text-right select-none border-r border-slate-700/30 bg-slate-950/50">
                                {line.lineNumber}
                              </span>
                              <span
                                className={cn(
                                  "px-3 py-1.5 whitespace-pre flex-1",
                                  line.type === 'add' && "text-green-300 font-medium bg-green-500/5",
                                  line.type === 'remove' && "text-red-300 font-medium line-through decoration-red-400/50 bg-red-500/5",
                                  line.type === 'same' && "text-slate-400"
                                )}
                              >
                                {line.type === 'add' && <span className="text-green-400 font-bold mr-2">+</span>}
                                {line.type === 'remove' && <span className="text-red-400 font-bold mr-2">-</span>}
                                {line.type === 'same' && <span className="text-slate-600 mr-2"> </span>}
                                {line.line || ' '}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Action Buttons - Always Visible Footer */}
      <div className="flex-shrink-0 px-4 py-3 bg-slate-900 border-t-2 border-purple-500/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
            <span className="font-semibold">
              {selectedFiles.size} of {edit.files.length} file{edit.files.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={isApplying}
            className="border-2 border-red-500/50 text-red-400 hover:bg-red-500/30 hover:border-red-500 transition-all duration-200 hover:scale-105 font-semibold"
          >
            <X className="w-4 h-4 mr-2" />
            Undo
          </Button>
          
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={selectedFiles.size === 0 || isApplying}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-green-500/50 hover:scale-105 px-8 border-2 border-green-500/30"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Keep Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
