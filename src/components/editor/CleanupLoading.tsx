'use client';

import { motion } from 'framer-motion';
import { Home, Loader2, Check, Save, Database } from 'lucide-react';

export function CleanupLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 p-8">
        {/* Animated icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-2xl">
            <Home className="w-12 h-12 text-white" />
          </div>
        </motion.div>

        {/* Loading text */}
        <div className="text-center space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white"
          >
            Returning Home
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-slate-400 text-lg"
          >
            Saving your progress and cleaning up...
          </motion.p>
        </div>

        {/* Progress steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-3 w-80"
        >
          <CleanupStep 
            icon={<Save className="w-4 h-4" />}
            text="Saving files"
            delay={0.5}
          />
          <CleanupStep 
            icon={<Database className="w-4 h-4" />}
            text="Syncing to GitHub"
            delay={0.7}
          />
          <CleanupStep 
            icon={<Loader2 className="w-4 h-4 animate-spin" />}
            text="Cleaning up containers"
            delay={0.9}
          />
        </motion.div>

        {/* Loading bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full"
          style={{ width: '320px' }}
        />
      </div>
    </div>
  );
}

function CleanupStep({ icon, text, delay }: { icon: React.ReactNode; text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm"
    >
      <div className="text-purple-400">
        {icon}
      </div>
      <span className="text-slate-300 text-sm font-medium">{text}</span>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.8 }}
        className="ml-auto"
      >
        <Check className="w-4 h-4 text-green-400" />
      </motion.div>
    </motion.div>
  );
}
