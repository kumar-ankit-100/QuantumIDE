"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { 
  Code2, 
  Sparkles, 
  Rocket, 
  Zap,
  Github,
  Terminal,
  Cloud,
  Shield,
  ArrowRight,
  CheckCircle2,
  Users,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Navbar } from "./Navbar";

const features = [
  {
    icon: <Code2 className="w-6 h-6" />,
    title: "Code in Your Browser",
    description: "Full-featured code editor with syntax highlighting, IntelliSense, and debugging"
  },
  {
    icon: <Terminal className="w-6 h-6" />,
    title: "Integrated Terminal",
    description: "Run commands, install packages, and manage your project from the browser"
  },
  {
    icon: <Cloud className="w-6 h-6" />,
    title: "Cloud-Based",
    description: "Access your projects from anywhere, on any device with just a browser"
  },
  {
    icon: <Github className="w-6 h-6" />,
    title: "GitHub Integration",
    description: "Automatic sync with GitHub repositories, commit and push directly from the IDE"
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Live Preview",
    description: "See your changes instantly with hot reload and live preview functionality"
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Isolated Containers",
    description: "Each project runs in its own Docker container for security and reliability"
  }
];

const templates = [
  { name: "Next.js", color: "text-blue-500", bg: "bg-blue-500/10" },
  { name: "React + Vite", color: "text-purple-500", bg: "bg-purple-500/10" },
  { name: "Node.js", color: "text-green-500", bg: "bg-green-500/10" },
  { name: "Vanilla JS", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { name: "C++", color: "text-blue-400", bg: "bg-blue-400/10" },
];

const stats = [
  { label: "Active Users", value: "10K+", icon: <Users className="w-5 h-5" /> },
  { label: "Projects Created", value: "50K+", icon: <Rocket className="w-5 h-5" /> },
  { label: "Countries", value: "120+", icon: <Globe className="w-5 h-5" /> },
];

export function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleGetStarted = () => {
    if (session) {
      router.push('/dashboard');
    } else {
      router.push('/register');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-20">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative container mx-auto px-4 py-20">
          {/* Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">Cloud-Based Development Platform</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Code Anywhere,
              <br />
              Deploy Everywhere
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto">
              A powerful cloud IDE that lets you code, collaborate, and deploy without installing anything.
              Start building in seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-full shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all"
              >
                {session ? 'Go to Dashboard' : 'Get Started Free'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              
              {!session && (
                <Button
                  onClick={() => router.push('/login')}
                  size="lg"
                  variant="outline"
                  className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 px-8 py-6 text-lg rounded-full"
                >
                  Sign In
                </Button>
              )}
            </div>

            {/* Tech Stack Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-16 flex flex-wrap gap-3 justify-center"
            >
              {templates.map((template, i) => (
                <motion.div
                  key={template.name}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className={cn(
                    "px-4 py-2 rounded-full border backdrop-blur-sm",
                    template.bg,
                    `border-${template.color.split('-')[1]}-500/20`
                  )}
                >
                  <span className={cn("text-sm font-medium", template.color)}>
                    {template.name}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="text-center p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm"
              >
                <div className="flex justify-center mb-3">
                  <div className="p-3 rounded-full bg-purple-500/10 text-purple-400">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-slate-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Everything You Need to Code
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            A complete development environment in your browser with all the tools you need
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm hover:border-purple-500/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 to-pink-600 p-12 md:p-16 text-center"
        >
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Start Coding?
            </h2>
            <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
              Join thousands of developers building amazing projects in the cloud
            </p>
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-white text-purple-600 hover:bg-slate-100 px-8 py-6 text-lg rounded-full shadow-xl"
            >
              {session ? 'Go to Dashboard' : 'Create Your First Project'}
              <Rocket className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Code2 className="w-6 h-6 text-purple-400" />
              <span className="text-lg font-bold text-white">QuantumIDE</span>
            </div>
            <p className="text-slate-400 text-sm">
              © 2025 QuantumIDE. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
                Login
              </Link>
              <Link href="/register" className="text-slate-400 hover:text-white transition-colors">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
