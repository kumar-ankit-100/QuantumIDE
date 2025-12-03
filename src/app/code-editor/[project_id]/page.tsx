"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import MonacoEditor from "@monaco-editor/react";

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

function FileTree({
  nodes,
  onSelect,
  currentFile,
}: {
  nodes: FileNode[];
  onSelect: (filePath: string) => void;
  currentFile: string | null;
}) {
  return (
    <ul className="pl-2">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.isDirectory ? (
            <details open>
              <summary className="cursor-pointer font-bold hover:bg-gray-200 p-1 rounded">
                📁 {node.name}
              </summary>
              {node.children && (
                <FileTree nodes={node.children} onSelect={onSelect} currentFile={currentFile} />
              )}
            </details>
          ) : (
            <div
              className={`cursor-pointer hover:bg-blue-200 p-1 rounded ml-2 ${
                currentFile === node.path ? "bg-blue-300 font-semibold" : ""
              }`}
              onClick={() => onSelect(node.path)}
            >
              📄 {node.name}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CodeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.project_id as string;

  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [serverPort, setServerPort ] = useState("null");
  const [showPreview, setShowPreview] = useState(false);
  const [gitStatus, setGitStatus] = useState<{
    hasChanges: boolean;
    branch: string;
    lastCommit: string;
  } | null>(null);
  const [isPushing, setIsPushing] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChangesRef = useRef(false);

  // Load file list
  useEffect(() => {
    fetch(`/api/projects/files?containerId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        setFiles(data.files);
        const firstFile = findFirstFile(data.files);
        if (firstFile) setCurrentFile(firstFile.path);
      })
      .catch((err) => console.error("Failed to load files:", err));
      console.log("Fetching file list for project:", currentFile);
  }, [projectId]);

  // Load file content
  useEffect(() => {
    if (!currentFile) return;

    setSaveStatus("saved");
    hasUnsavedChangesRef.current = false;

    fetch(`/api/projects/file?projectId=${projectId}&filePath=${currentFile}`)
      .then((res) => res.json())
      .then((data) => setFileContent(data.content))
      .catch((err) => console.error("Failed to load file:", err));
  }, [currentFile, projectId]);

  // Check Git status periodically
  useEffect(() => {
    const checkGitStatus = async () => {
      try {
        const res = await fetch(`/api/projects/sync?projectId=${projectId}`);
        if (res.ok) {
          const status = await res.json();
          setGitStatus(status);
        }
      } catch (err) {
        console.error("Git status check failed:", err);
      }
    };

    // Initial check
    checkGitStatus();

    // Periodic check every 10 seconds
    const interval = setInterval(checkGitStatus, 10000);

    return () => clearInterval(interval);
  }, [projectId]);

  // Cleanup on unmount/tab close
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Save any unsaved changes
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }

      // Trigger cleanup
      try {
        await fetch("/api/projects/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            deleteS3Files: false, // Keep S3 files
          }),
          keepalive: true, // Important for requests during page unload
        });
      } catch (err) {
        console.error("Cleanup failed:", err);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      // Final cleanup on component unmount
      fetch("/api/projects/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          deleteS3Files: false,
        }),
        keepalive: true,
      }).catch(err => console.error("Cleanup failed:", err));
    };
  }, [projectId]);

  // Check server status periodically
  // useEffect(() => {
  //   const checkStatus = async () => {
  //     try {
  //       const res = await fetch(`/api/projects/run?projectId=${projectId}`);
  //       const data = await res.json();
  //       console.log("Server status:", data, "port:", serverPort);
  //       if (serverPort == "null") setIsServerRunning(false);
  //       else
  //       setIsServerRunning(true);
  //     } catch (err) {
  //       console.error("Failed to check server status:", err);
  //     }
  //   };

  //   checkStatus();
  //   const interval = setInterval(checkStatus, 5000);
  //   return () => clearInterval(interval);
  // }, [projectId]);

  const findFirstFile = (nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (!node.isDirectory) return node;
      if (node.children) {
        const found = findFirstFile(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const saveFile = useCallback(async () => {
    if (!currentFile || !hasUnsavedChangesRef.current) return;

    setSaveStatus("saving");
    console.log("Saving file:", currentFile, "content ", fileContent);
    try {
      await fetch("/api/projects/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filePath: currentFile,
          content: fileContent,
        }),
      });

      setSaveStatus("saved");
      setLastSaved(new Date());
      hasUnsavedChangesRef.current = false;
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("unsaved");
    }
  }, [currentFile, fileContent, projectId]);

  const handleEditorChange = (value: string | undefined) => {
    setFileContent(value || "");
    setSaveStatus("unsaved");
    hasUnsavedChangesRef.current = true;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveFile();
    }, 2000);
  };

  const startServer = async () => {
    try {
      const res = await fetch("/api/projects/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, port: serverPort }),
      });
      // console.log("Start server response:", (await res.json()).port);
      const data = await res.json();
      console.log("Start server response data:", data);

      if (res.ok) {
        setIsServerRunning(true);
        setShowPreview(true);
        setServerPort(data.port);
      }
    } catch (err) {
      console.error("Failed to start server:", err);
      alert("Failed to start development server");
    }
  };

  const stopServer = async () => {
    try {
      const res = await fetch("/api/projects/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, syncToS3: true }),
      });

      if (res.ok) {
        setIsServerRunning(false);
        setShowPreview(false);
      }
    } catch (err) {
      console.error("Failed to stop server:", err);
    }
  };

  const [showGitModal, setShowGitModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState("Save from QuantumIDE");
  const [githubRepoUrl, setGithubRepoUrl] = useState("");

  const commitAndPush = async () => {
    setShowGitModal(true);
  };

  const handleGitSync = async () => {
    setIsPushing(true);
    try {
      const res = await fetch("/api/projects/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId,
          repoUrl: githubRepoUrl || undefined,
          message: commitMessage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setShowGitModal(false);
        // Refresh git status
        const statusRes = await fetch(`/api/projects/sync?projectId=${projectId}`);
        if (statusRes.ok) {
          setGitStatus(await statusRes.json());
        }
      } else {
        const error = await res.json();
        alert(`Git sync failed: ${error.error}`);
      }
    } catch (err) {
      console.error("Git sync failed:", err);
      alert("Failed to commit/push");
    } finally {
      setIsPushing(false);
    }
  };

  const handleExitProject = async () => {
    if (hasUnsavedChangesRef.current) {
      const confirm = window.confirm("You have unsaved changes. Save before exiting?");
      if (confirm) {
        await saveFile();
      }
    }

    // Cleanup and navigate away
    try {
      await fetch("/api/projects/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          deleteS3Files: false, // Keep files in S3
        }),
      });

      router.push("/dashboard");
    } catch (err) {
      console.error("Exit cleanup failed:", err);
      router.push("/dashboard");
    }
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

  const formatLastSaved = () => {
    if (!lastSaved) return "";
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };



  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white p-4 overflow-y-auto border-r border-gray-700">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">📂 Project</h2>
            <button
              onClick={handleExitProject}
              className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
              title="Exit Project"
            >
              ✕ Exit
            </button>
          </div>

          {/* Git Status */}
          <div className="mb-3 p-2 bg-gray-700 rounded text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">🔀 Git Status</span>
              <span className={gitStatus?.hasChanges ? "text-yellow-400" : "text-green-400"}>
                {gitStatus?.hasChanges ? "● Modified" : "✓ Clean"}
              </span>
            </div>
            {gitStatus && (
              <>
                <div className="text-gray-400 text-xs mb-1">
                  Branch: {gitStatus.branch}
                </div>
                <div className="text-gray-400 text-xs mb-2 truncate" title={gitStatus.lastCommit}>
                  {gitStatus.lastCommit}
                </div>
              </>
            )}
            <button
              onClick={commitAndPush}
              disabled={isPushing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-xs py-1 px-2 rounded"
            >
              {isPushing ? "Pushing..." : "Commit & Push"}
            </button>
          </div>

          {/* GitHub Modal */}
          {showGitModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold mb-4 text-white">Commit & Push to GitHub</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      GitHub Repository URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://github.com/user/repo.git (optional)"
                      value={githubRepoUrl}
                      onChange={(e) => setGithubRepoUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Leave empty to commit locally only
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Commit Message
                    </label>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setShowGitModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm"
                    disabled={isPushing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGitSync}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm disabled:bg-gray-600"
                    disabled={isPushing}
                  >
                    {isPushing ? "Syncing..." : "Commit & Push"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Server Controls */}
          <div className="mb-4 p-3 bg-gray-700 rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Dev Server</span>
              <span className={`text-xs ${isServerRunning ? "text-green-400" : "text-gray-400"}`}>
                {isServerRunning ? "● Running" : "○ Stopped"}
              </span>
            </div>
            {!isServerRunning ? (
              <button
                onClick={startServer}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-1.5 px-3 rounded"
              >
                ▶ Start Server
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={stopServer}
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 px-3 rounded"
                >
                  ■ Stop Server
                </button>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 px-3 rounded"
                >
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </button>
              </div>
            )}
          </div>
        </div>

        <FileTree nodes={files} onSelect={setCurrentFile} currentFile={currentFile} />
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {currentFile ? (
          <>
            {/* Top Bar */}
            <div className="p-3 bg-gray-800 text-white flex justify-between items-center border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">{currentFile}</span>
                <span className="text-xs text-gray-400">
                  {saveStatus === "saved" && "✓ Saved"}
                  {saveStatus === "saving" && "⏳ Saving..."}
                  {saveStatus === "unsaved" && "● Unsaved"}
                </span>
                {lastSaved && saveStatus === "saved" && (
                  <span className="text-xs text-gray-500">{formatLastSaved()}</span>
                )}
              </div>
              <button
                className={`px-4 py-1.5 rounded text-sm font-medium transition ${
                  saveStatus === "saving"
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={saveFile}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving" ? "Saving..." : "Save (Ctrl+S)"}
              </button>
            </div>

            {/* Editor and Preview */}
            <div className="flex-1 flex">
              {/* Monaco Editor */}
              <div className={showPreview ? "w-1/2" : "w-full"}>
                <MonacoEditor
                  height="100%"
                  defaultLanguage="javascript"
                  value={fileContent}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    minimap: { enabled: true },
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                  }}
                />
              </div>

              {/* Live Preview */}
              {showPreview && isServerRunning && (
                <div className="w-1/2 border-l border-gray-700 bg-white">
                  <iframe
                    src={`http://localhost:${serverPort}`}
                    className="w-full h-full border-0"
                    title="Live Preview"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
}