// app/(auth)/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Lock, Sparkles, ArrowRight, Github, Chrome } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Registration failed");
        setIsLoading(false);
        return;
      }
      
      const signInResponse = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });
      
      const r: any = signInResponse;
      if (r?.error) {
        setError("Invalid credentials");
        setIsLoading(false);
        return;
      }
      
      router.push("/");
    } catch (err) {
      setError("Network error");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-zinc-950">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />
      
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-zinc-700/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-0 -right-40 w-80 h-80 bg-zinc-600/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-20 w-80 h-80 bg-zinc-700/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Subtle animated lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent animate-slide-line"
            style={{
              top: `${20 + i * 30}%`,
              left: '-100%',
              width: '100%',
              animationDelay: `${i * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md py-8 px-4 animate-fade-in-up">
        {/* Logo and title */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 mb-4 shadow-lg border border-zinc-700/50 animate-float">
            <Sparkles className="w-7 h-7 text-zinc-100" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2 tracking-tight">
            Create an account
          </h1>
          <p className="text-zinc-400 text-sm">
            Start your journey with us today
          </p>
        </div>

        <Card className="border border-zinc-800/50 shadow-2xl bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-zinc-100 text-center">
              Sign up
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your information to create an account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Social login buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="bg-zinc-800/50 border-zinc-700/50 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 transition-all duration-300 hover:border-zinc-600"
              >
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-zinc-800/50 border-zinc-700/50 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 transition-all duration-300 hover:border-zinc-600"
              >
                <Chrome className="w-4 h-4 mr-2" />
                Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900 px-2 text-zinc-500">Or continue with</span>
              </div>
            </div>

            <div className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-200 font-medium text-sm">
                  Name
                </Label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-zinc-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-10 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all duration-300 hover:bg-zinc-800/70 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-200 font-medium text-sm">
                  Email
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-zinc-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all duration-300 hover:bg-zinc-800/70 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-200 font-medium text-sm">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-zinc-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all duration-300 hover:bg-zinc-800/70 h-11"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-950/50 border-red-900/50 animate-shake">
                  <AlertDescription className="text-red-400 text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-semibold h-11 rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin mr-2" />
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Create Account
                    <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </div>

            <p className="text-center text-zinc-500 text-xs px-4">
              By signing up, you agree to our{" "}
              <a href="#" className="text-zinc-400 hover:text-zinc-300 underline underline-offset-4 transition-colors">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-zinc-400 hover:text-zinc-300 underline underline-offset-4 transition-colors">
                Privacy Policy
              </a>
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-zinc-400 text-sm">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-zinc-100 hover:text-white font-semibold transition-colors underline-offset-4 hover:underline"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes blob {
          0%, 100% { 
            transform: translate(0px, 0px) scale(1);
          }
          33% { 
            transform: translate(30px, -50px) scale(1.1);
          }
          66% { 
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px);
          }
          50% { 
            transform: translateY(-10px);
          }
        }
        
        @keyframes fade-in-up {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-line {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        
        .animate-slide-line {
          animation: slide-line 8s linear infinite;
        }
        
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}