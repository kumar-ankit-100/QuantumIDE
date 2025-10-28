"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Code2 } from "lucide-react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function createProject() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects/create", { method: "POST" });
      const data = await res.json();

      if (data.projectId) {
        // Navigate to IDE page with projectId
        router.push(`/ide/${data.projectId}`);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <Card className="p-12 max-w-2xl w-full text-center">
        <div className="flex justify-center mb-6">
          <Code2 className="w-20 h-20 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-4">QuantumIDE</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          Cloud-based IDE with containerized development environments
        </p>
        <Button 
          size="lg" 
          onClick={createProject} 
          disabled={loading}
          className="min-w-[200px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating Project...
            </>
          ) : (
            "Create New Project"
          )}
        </Button>
        <div className="mt-8 text-sm text-muted-foreground">
          <p>✨ React + Vite template</p>
          <p>🐳 Docker containerized</p>
          <p>⚡ Live preview & hot reload</p>
        </div>
      </Card>
    </div>
  );
}
