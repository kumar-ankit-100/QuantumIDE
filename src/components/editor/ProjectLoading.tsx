'use client';

import { motion } from 'framer-motion';
import { Code2, Loader2, GitBranch, Container, Zap, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProjectLoadingProps {
  status: 'cloning' | 'installing' | 'starting' | 'ready';
  message?: string;
  percentage?: number;
}

export function ProjectLoading({ status, message, percentage }: ProjectLoadingProps) {
  const steps = [
    { key: 'cloning', icon: GitBranch, label: 'Cloning from GitHub', color: 'text-blue-500', bgColor: 'bg-blue-500', percentage: 25 },
    { key: 'installing', icon: Container, label: 'Installing dependencies', color: 'text-purple-500', bgColor: 'bg-purple-500', percentage: 60 },
    { key: 'starting', icon: Zap, label: 'Starting dev server', color: 'text-yellow-500', bgColor: 'bg-yellow-500', percentage: 85 },
    { key: 'ready', icon: Code2, label: 'Ready to code', color: 'text-green-500', bgColor: 'bg-green-500', percentage: 100 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === status);
  const currentPercentage = percentage || steps[currentStepIndex]?.percentage || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-8 w-full max-w-2xl px-6">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-blue-500/30 blur-3xl rounded-full animate-pulse" />
          <div className="relative p-8 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-2xl">
            <Code2 className="w-20 h-20 text-blue-400 animate-pulse" />
          </div>
        </motion.div>

        {/* Percentage Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <motion.div
            key={currentPercentage}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            {currentPercentage}%
          </motion.div>
          <p className="text-slate-400 text-lg font-medium">
            {steps[currentStepIndex]?.label || 'Loading...'}
          </p>
        </motion.div>

        {/* Progress Bar */}
        <div className="w-full space-y-3">
          <div className="relative h-3 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${currentPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-lg shadow-blue-500/50`}
            >
              <motion.div
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: 'linear',
                }}
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              />
            </motion.div>
          </div>
        </div>

        {/* Loading Steps */}
        <div className="space-y-3 w-full">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center space-x-4 p-4 rounded-lg border transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/50 shadow-lg shadow-blue-500/20 scale-105'
                    : isCompleted
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-slate-800/30 border-slate-700/30 opacity-50'
                }`}
              >
                <div className={`transition-all duration-300 ${isActive || isCompleted ? step.color : 'text-slate-500'}`}>
                  {isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                      <Loader2 className="w-6 h-6" />
                    </motion.div>
                  ) : isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      <Check className="w-6 h-6 text-green-500" />
                    </motion.div>
                  ) : (
                    <StepIcon className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1">
                  <p className={`text-base font-semibold transition-colors ${
                    isActive ? 'text-blue-300' : isCompleted ? 'text-green-400' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </p>
                </div>

                <div className={`text-sm font-mono ${
                  isActive ? 'text-blue-400' : isCompleted ? 'text-green-400' : 'text-slate-600'
                }`}>
                  {isCompleted ? '100%' : isActive ? `${step.percentage}%` : '0%'}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Message */}
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground text-center max-w-md"
          >
            {message}
          </motion.p>
        )}

        {/* Animated Dots */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
