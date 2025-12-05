'use client';

import { useState, useRef, useEffect } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit2,
  Copy,
  Scissors,
  MoreVertical,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileExplorerProps {
  fileTree: FileNode[];
  selectedFile: string;
  expandedFolders: Set<string>;
  projectId: string;
  onFileSelect: (path: string) => void;
  onToggleFolder: (path: string) => void;
  onRefreshTree: () => Promise<void>;
}

export default function FileExplorer({
  fileTree,
  selectedFile,
  expandedFolders,
  projectId,
  onFileSelect,
  onToggleFolder,
  onRefreshTree,
}: FileExplorerProps) {
  const [contextMenuNode, setContextMenuNode] = useState<FileNode | null>(null);
  const [renamingNode, setRenamingNode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ node: FileNode; action: 'copy' | 'cut' } | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ path: string; type: 'file' | 'folder' } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [hasValidationError, setHasValidationError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingNode, creatingIn]);

  const handleCreate = async (parentPath: string, type: 'file' | 'folder') => {
    setCreatingIn({ path: parentPath, type });
    setNewItemName('');
    setHasValidationError(false);
    // Expand parent folder if it's a directory
    if (!expandedFolders.has(parentPath)) {
      onToggleFolder(parentPath);
    }
  };

  const checkDuplicateName = (parentPath: string, name: string): boolean => {
    const findNodeByPath = (nodes: FileNode[], path: string): FileNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findNodeByPath(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    // Get parent node
    if (!parentPath) {
      // Check root level
      return fileTree.some(node => node.name === name);
    } else {
      const parentNode = findNodeByPath(fileTree, parentPath);
      if (parentNode?.children) {
        return parentNode.children.some(child => child.name === name);
      }
    }
    return false;
  };

  const handleCreateSubmit = async () => {
    if (!creatingIn || !newItemName.trim()) return;

    // Check for duplicate names
    if (checkDuplicateName(creatingIn.path, newItemName)) {
      setHasValidationError(true);
      alert(`A file or folder named "${newItemName}" already exists at this location.`);
      // Keep the input focused so user can change the name
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
      return;
    }

    try {
      const fullPath = creatingIn.path ? `${creatingIn.path}/${newItemName}` : newItemName;
      
      const res = await fetch(`/api/projects/${projectId}/files/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, type: creatingIn.type }),
      });

      if (!res.ok) throw new Error('Failed to create item');

      await onRefreshTree();
      setCreatingIn(null);
      setNewItemName('');
      setHasValidationError(false);

      // If it's a file, open it
      if (creatingIn.type === 'file') {
        onFileSelect(fullPath);
      }
    } catch (err) {
      console.error('Failed to create item:', err);
      alert('Failed to create item');
    }
  };

  const handleRename = async (node: FileNode) => {
    setRenamingNode(node.path);
    setRenameValue(node.name);
    setHasValidationError(false);
  };

  const handleRenameSubmit = async () => {
    if (!renamingNode || !renameValue.trim()) return;

    const oldPath = renamingNode;
    const pathParts = oldPath.split('/');
    const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
    
    // Check for duplicate names (but allow same name if unchanged)
    if (pathParts[pathParts.length - 1] !== renameValue && checkDuplicateName(parentPath, renameValue)) {
      setHasValidationError(true);
      alert(`A file or folder named "${renameValue}" already exists at this location.`);
      // Keep the input focused so user can change the name
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
      return;
    }

    try {
      pathParts[pathParts.length - 1] = renameValue;
      const newPath = pathParts.join('/');

      // If name unchanged, just cancel rename mode
      if (oldPath === newPath) {
        setRenamingNode(null);
        setHasValidationError(false);
        return;
      }

      const res = await fetch(`/api/projects/${projectId}/files/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath }),
      });

      if (!res.ok) throw new Error('Failed to rename');

      await onRefreshTree();
      setRenamingNode(null);
      setHasValidationError(false);

      // Update selected file if it was renamed
      if (selectedFile === oldPath) {
        onFileSelect(newPath);
      }
    } catch (err) {
      console.error('Failed to rename:', err);
      alert('Failed to rename item');
    }
  };

  const handleDelete = async (node: FileNode) => {
    const confirmMsg = node.type === 'directory' 
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete file "${node.name}"?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, type: node.type }),
      });

      if (!res.ok) throw new Error('Failed to delete');

      await onRefreshTree();

      // Clear selection if deleted file was selected
      if (selectedFile === node.path) {
        onFileSelect('');
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete item');
    }
  };

  const handleCopy = (node: FileNode) => {
    setClipboard({ node, action: 'copy' });
  };

  const handleCut = (node: FileNode) => {
    setClipboard({ node, action: 'cut' });
  };

  const handlePaste = async (targetPath: string) => {
    if (!clipboard) return;

    try {
      const targetDir = targetPath || '';
      const newName = clipboard.node.name;
      const newPath = targetDir ? `${targetDir}/${newName}` : newName;

      if (clipboard.action === 'copy') {
        // Copy file/folder
        const res = await fetch(`/api/projects/${projectId}/files/copy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourcePath: clipboard.node.path,
            targetPath: newPath,
            type: clipboard.node.type,
          }),
        });

        if (!res.ok) throw new Error('Failed to copy');
      } else {
        // Move file/folder
        const res = await fetch(`/api/projects/${projectId}/files/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldPath: clipboard.node.path,
            newPath,
          }),
        });

        if (!res.ok) throw new Error('Failed to move');
      }

      await onRefreshTree();
      setClipboard(null);
    } catch (err) {
      console.error('Failed to paste:', err);
      alert('Failed to paste item');
    }
  };

  const handleDragStart = (e: React.DragEvent, node: FileNode) => {
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, node: FileNode) => {
    if (!draggedNode || draggedNode.path === node.path) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Only allow dropping on folders
    if (node.type === 'directory') {
      setDropTarget(node.path);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, targetNode: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedNode || draggedNode.path === targetNode.path) return;
    if (targetNode.type !== 'directory') return;

    try {
      const newPath = `${targetNode.path}/${draggedNode.name}`;

      const res = await fetch(`/api/projects/${projectId}/files/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: draggedNode.path,
          newPath,
        }),
      });

      if (!res.ok) throw new Error('Failed to move');

      await onRefreshTree();
      
      // Update selected file if it was moved
      if (selectedFile === draggedNode.path) {
        onFileSelect(newPath);
      }
    } catch (err) {
      console.error('Failed to move:', err);
      alert('Failed to move item');
    } finally {
      setDraggedNode(null);
      setDropTarget(null);
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const iconClass = "w-4 h-4";
    
    // Color coding based on file type
    if (ext === 'tsx' || ext === 'jsx') return <File className={cn(iconClass, "text-blue-400")} />;
    if (ext === 'ts' || ext === 'js') return <File className={cn(iconClass, "text-yellow-400")} />;
    if (ext === 'css' || ext === 'scss') return <File className={cn(iconClass, "text-pink-400")} />;
    if (ext === 'html') return <File className={cn(iconClass, "text-orange-400")} />;
    if (ext === 'json') return <File className={cn(iconClass, "text-green-400")} />;
    if (ext === 'md') return <File className={cn(iconClass, "text-purple-400")} />;
    
    return <File className={cn(iconClass, "text-slate-400")} />;
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    const isRenaming = renamingNode === node.path;
    const isDragTarget = dropTarget === node.path;
    const isBeingDragged = draggedNode?.path === node.path;

    // Show creating input in this folder
    const showCreateInput = creatingIn && creatingIn.path === node.path;

    if (node.type === 'directory') {
      return (
        <div key={node.path}>
          <ContextMenu>
            <ContextMenuTrigger>
              <div
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-200 group',
                  'hover:bg-slate-800/50',
                  isSelected && 'bg-blue-600/20 border-l-2 border-blue-500',
                  isDragTarget && 'bg-blue-600/30 border-2 border-dashed border-blue-500',
                  isBeingDragged && 'opacity-50'
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                draggable
                onDragStart={(e) => handleDragStart(e, node)}
                onDragOver={(e) => handleDragOver(e, node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, node)}
                onClick={() => onToggleFolder(node.path)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-yellow-400" />
                ) : (
                  <Folder className="w-4 h-4 text-yellow-500" />
                )}
                {isRenaming ? (
                  <Input
                    ref={inputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      if (!hasValidationError) handleRenameSubmit();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') setRenamingNode(null);
                    }}
                    className="h-6 px-1 py-0 text-sm bg-slate-800 border-slate-600 text-slate-200 flex-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-sm text-slate-300 flex-1">{node.name}</span>
                )}
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreate(node.path, 'file');
                    }}
                    className="p-1 hover:bg-slate-700 rounded"
                    title="New File"
                  >
                    <FilePlus className="w-3 h-3 text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreate(node.path, 'folder');
                    }}
                    className="p-1 hover:bg-slate-700 rounded"
                    title="New Folder"
                  >
                    <FolderPlus className="w-3 h-3 text-yellow-400" />
                  </button>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-slate-900 border-slate-700 text-slate-200">
              <ContextMenuItem onClick={() => handleCreate(node.path, 'file')} className="hover:bg-slate-800">
                <FilePlus className="w-4 h-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCreate(node.path, 'folder')} className="hover:bg-slate-800">
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-slate-700" />
              <ContextMenuItem onClick={() => handleRename(node)} className="hover:bg-slate-800">
                <Edit2 className="w-4 h-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCopy(node)} className="hover:bg-slate-800">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCut(node)} className="hover:bg-slate-800">
                <Scissors className="w-4 h-4 mr-2" />
                Cut
              </ContextMenuItem>
              {clipboard && (
                <ContextMenuItem onClick={() => handlePaste(node.path)} className="hover:bg-slate-800">
                  Paste
                </ContextMenuItem>
              )}
              <ContextMenuSeparator className="bg-slate-700" />
              <ContextMenuItem onClick={() => handleDelete(node)} className="hover:bg-red-900/50 text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {/* Show create input */}
          {showCreateInput && (
            <div
              className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded-md"
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              {creatingIn.type === 'folder' ? (
                <Folder className="w-4 h-4 text-yellow-500" />
              ) : (
                <File className="w-4 h-4 text-blue-400" />
              )}
              <Input
                ref={inputRef}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={() => {
                  if (!hasValidationError && newItemName.trim()) handleCreateSubmit();
                  else if (!newItemName.trim()) setCreatingIn(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubmit();
                  if (e.key === 'Escape') setCreatingIn(null);
                }}
                placeholder={`New ${creatingIn.type} name...`}
                className="h-6 px-1 py-0 text-sm bg-slate-800 border-slate-600 text-slate-200 flex-1"
              />
            </div>
          )}

          {isExpanded && node.children && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File node
    return (
      <ContextMenu key={node.path}>
        <ContextMenuTrigger>
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-200 group',
              'hover:bg-slate-800/50',
              isSelected && 'bg-blue-600/20 border-l-2 border-blue-500',
              isBeingDragged && 'opacity-50'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            draggable
            onDragStart={(e) => handleDragStart(e, node)}
            onClick={() => onFileSelect(node.path)}
          >
            {getFileIcon(node.name)}
            {isRenaming ? (
              <Input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenamingNode(null);
                }}
                className="h-6 px-1 py-0 text-sm bg-slate-800 border-slate-600 text-slate-200 flex-1"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm text-slate-300 flex-1">{node.name}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-slate-900 border-slate-700 text-slate-200">
          <ContextMenuItem onClick={() => handleRename(node)} className="hover:bg-slate-800">
            <Edit2 className="w-4 h-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleCopy(node)} className="hover:bg-slate-800">
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleCut(node)} className="hover:bg-slate-800">
            <Scissors className="w-4 h-4 mr-2" />
            Cut
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-slate-700" />
          <ContextMenuItem onClick={() => handleDelete(node)} className="hover:bg-red-900/50 text-red-400">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="p-2 space-y-1">
      {/* Root level action buttons */}
      <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-slate-700/50">
        <span className="text-xs text-slate-500 uppercase font-semibold">Explorer</span>
        <div className="flex gap-1">
          <button
            onClick={() => handleCreate('', 'file')}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="New File"
          >
            <FilePlus className="w-3.5 h-3.5 text-blue-400" />
          </button>
          <button
            onClick={() => handleCreate('', 'folder')}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5 text-yellow-400" />
          </button>
        </div>
      </div>

      {/* Root level create input */}
      {creatingIn && !creatingIn.path && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded-md mb-1">
          {creatingIn.type === 'folder' ? (
            <Folder className="w-4 h-4 text-yellow-500" />
          ) : (
            <File className="w-4 h-4 text-blue-400" />
          )}
          <Input
            ref={inputRef}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={() => {
              if (!hasValidationError && newItemName.trim()) handleCreateSubmit();
              else if (!newItemName.trim()) setCreatingIn(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubmit();
              if (e.key === 'Escape') setCreatingIn(null);
            }}
            placeholder={`New ${creatingIn.type} name...`}
            className="h-6 px-1 py-0 text-sm bg-slate-800 border-slate-600 text-slate-200 flex-1"
          />
        </div>
      )}

      {fileTree.map((node) => renderNode(node))}
    </div>
  );
}
