"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle, ChevronRight } from "lucide-react";

export interface SetupStep {
  id: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  output?: string[];
  startTime?: number;
  endTime?: number;
}

interface SetupTerminalProps {
  steps: SetupStep[];
  title?: string;
  onComplete?: () => void;
}

export default function SetupTerminal({ steps, title = "Project Setup", onComplete }: SetupTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [steps]);

  useEffect(() => {
    const allCompleted = steps.every(s => s.status === "success" || s.status === "error");
    if (allCompleted && onComplete) {
      onComplete();
    }
  }, [steps, onComplete]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const getStepIcon = (step: SetupStep) => {
    switch (step.status) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
      case "running":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />;
    }
  };

  const getDuration = (step: SetupStep) => {
    if (!step.startTime) return null;
    const end = step.endTime || Date.now();
    const duration = ((end - step.startTime) / 1000).toFixed(2);
    return `${duration}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-gray-700 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
        </div>

        {/* Terminal Content */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-sm"
          style={{
            scrollBehavior: "smooth",
          }}
        >
          {steps.map((step, index) => (
            <div key={step.id} className="space-y-2">
              {/* Step Header */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                  step.status === "running"
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : step.status === "success"
                    ? "bg-green-500/10 border border-green-500/30"
                    : step.status === "error"
                    ? "bg-red-500/10 border border-red-500/30"
                    : "bg-gray-800/50 border border-gray-700/50"
                }`}
                onClick={() => step.output && step.output.length > 0 && toggleStep(step.id)}
              >
                {getStepIcon(step)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-200 font-medium">{step.label}</span>
                    {step.status === "running" && (
                      <span className="text-xs text-blue-400 animate-pulse">running...</span>
                    )}
                  </div>
                </div>
                {getDuration(step) && (
                  <span className="text-xs text-gray-500 tabular-nums">{getDuration(step)}</span>
                )}
                {step.output && step.output.length > 0 && (
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      expandedSteps.has(step.id) ? "rotate-90" : ""
                    }`}
                  />
                )}
              </div>

              {/* Step Output */}
              {expandedSteps.has(step.id) && step.output && step.output.length > 0 && (
                <div className="ml-8 pl-4 border-l-2 border-gray-700 space-y-1">
                  {step.output.map((line, i) => (
                    <div
                      key={i}
                      className="text-xs text-gray-400 animate-fadeIn"
                      style={{
                        animationDelay: `${i * 30}ms`,
                      }}
                    >
                      <span className="text-gray-600 mr-2">$</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator for active steps */}
          {steps.some(s => s.status === "running") && (
            <div className="flex items-center gap-2 text-gray-400 text-xs mt-4">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
              <span>Processing...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 bg-gray-900/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                {steps.filter(s => s.status === "success").length}/{steps.length} completed
              </span>
              {steps.some(s => s.status === "error") && (
                <span className="text-red-400">
                  {steps.filter(s => s.status === "error").length} failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
