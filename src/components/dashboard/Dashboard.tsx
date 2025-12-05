"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { 
  Code2, 
  Sparkles, 
  Rocket, 
  Layers, 
  Database, 
  Globe, 
  Zap,
  Plus,
  Search,
  Filter,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProjectCard } from "./ProjectCard";
import { OngoingProjectCard } from "./OngoingProjectCard";
import { ProjectCreationModal } from "./ProjectCreationModal";
import LoadProjectModal from "./LoadProjectModal";
import { ProjectLoading } from "@/components/editor/ProjectLoading";
import SetupTerminal, { SetupStep } from "@/components/setup/SetupTerminal";
import { cn } from "@/lib/utils";

const PROJECT_TEMPLATES = [
  {
    id: "nextjs",
    name: "Next.js App",
    description: "Full-stack React framework with SSR, API routes, and more",
    icon: <Code2 className="w-5 h-5 text-blue-600" />,
    techStack: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
    features: [
      "Server-side rendering",
      "API routes built-in",
      "Automatic code splitting",
      "File-based routing",
      "TypeScript support"
    ],
    difficulty: "Intermediate" as const,
    estimatedTime: "5-10 min"
  },
  {
    id: "react-vite",
    name: "React + Vite",
    description: "Lightning fast React development with Vite bundler",
    icon: <Zap className="w-5 h-5 text-purple-600" />,
    techStack: ["React", "Vite", "TypeScript", "ESLint"],
    features: [
      "Hot module replacement",
      "Fast build times",
      "TypeScript support",
      "Modern development server",
      "Optimized production builds"
    ],
    difficulty: "Beginner" as const,
    estimatedTime: "2-5 min"
  },
  {
    id: "node-express",
    name: "Node.js API",
    description: "RESTful API server with Express.js and modern tooling",
    icon: <Database className="w-5 h-5 text-green-600" />,
    techStack: ["Node.js", "Express", "TypeScript", "Prisma"],
    features: [
      "RESTful API structure",
      "Database integration",
      "Middleware support",
      "Environment configuration",
      "Error handling"
    ],
    difficulty: "Intermediate" as const,
    estimatedTime: "5-8 min"
  },
  {
    id: "vanilla-js",
    name: "Vanilla JavaScript",
    description: "Pure JavaScript project with modern ES6+ features",
    icon: <Globe className="w-5 h-5 text-yellow-600" />,
    techStack: ["JavaScript", "HTML5", "CSS3", "Webpack"],
    features: [
      "Modern JavaScript (ES6+)",
      "Module bundling",
      "Hot reload",
      "CSS preprocessing",
      "Development server"
    ],
    difficulty: "Beginner" as const,
    estimatedTime: "2-4 min"
  },
  {
    id: "fullstack-nextjs",
    name: "Full-Stack Next.js",
    description: "Complete web application with database and authentication",
    icon: <Layers className="w-5 h-5 text-indigo-600" />,
    techStack: ["Next.js", "Prisma", "NextAuth", "PostgreSQL", "Tailwind"],
    features: [
      "User authentication",
      "Database integration",
      "API routes",
      "Protected pages",
      "Responsive design"
    ],
    difficulty: "Advanced" as const,
    estimatedTime: "10-15 min"
  },
  {
    id: "python-fastapi",
    name: "Python FastAPI",
    description: "High-performance Python API with automatic docs",
    icon: <Rocket className="w-5 h-5 text-red-600" />,
    techStack: ["Python", "FastAPI", "SQLAlchemy", "Pydantic"],
    features: [
      "Automatic API documentation",
      "Type hints support",
      "High performance",
      "Easy testing",
      "Database ORM"
    ],
    difficulty: "Intermediate" as const,
    estimatedTime: "5-8 min"
  }
];

interface OngoingProject {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  lastModified: string;
  status: "running" | "stopped" | "error";
  containerPort?: number;
}

export function Dashboard() {
  const { data: session, status } = useSession();
  const [ongoingProjects, setOngoingProjects] = useState<OngoingProject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof PROJECT_TEMPLATES[0] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);
  const [showSetupTerminal, setShowSetupTerminal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load ongoing projects when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      loadOngoingProjects();
    }
  }, [status]);

  const loadOngoingProjects = async () => {
    setIsLoadingProjects(true);
    try {
      // Session is handled on server side, no need to pass userId
      const res = await fetch('/api/projects/list');
      const data = await res.json();
      
      if (data.projects) {
        const formattedProjects: OngoingProject[] = data.projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          techStack: project.techStack || [],
          lastModified: formatRelativeTime(project.lastModified),
          status: project.status,
          containerPort: project.containerPort
        }));
        
        setOngoingProjects(formattedProjects);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      setOngoingProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const formatRelativeTime = (isoString: string): string => {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now.getTime() - past.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return past.toLocaleDateString();
  };

  const filteredTemplates = PROJECT_TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.techStack.some(tech => tech.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDifficulty = selectedDifficulty === "all" || template.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesDifficulty;
  });

  const handleCreateProject = async (template: typeof PROJECT_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setShowModal(true);
  };

  const handleConfirmCreateProject = async (projectData: {
    name: string;
    description: string;
    template: typeof PROJECT_TEMPLATES[0];
    customTechStack: string[];
    createGithubRepo?: boolean;
  }) => {
    setShowModal(false);
    
    // Initialize setup steps
    const initialSteps: SetupStep[] = [
      { id: "1", label: "Creating project container", status: "pending" },
      { id: "2", label: "Setting up project structure", status: "pending" },
      { id: "3", label: "Installing dependencies", status: "pending" },
      { id: "4", label: "Initializing GitHub repository", status: "pending" },
      { id: "5", label: "Pushing initial commit", status: "pending" },
      { id: "6", label: "Starting development server", status: "pending" },
    ];
    
    setSetupSteps(initialSteps);
    setShowSetupTerminal(true);
    setIsCreating(true);
    
    try {
      // Simulate step updates (will be replaced with real WebSocket/SSE)
      const updateStep = (stepId: string, status: SetupStep["status"], output?: string[]) => {
        setSetupSteps(prev => prev.map(step => {
          if (step.id === stepId) {
            return {
              ...step,
              status,
              output,
              startTime: status === "running" ? Date.now() : step.startTime,
              endTime: status === "success" || status === "error" ? Date.now() : undefined,
            };
          }
          return step;
        }));
      };

      // Step 1: Create container
      updateStep("1", "running", ["Pulling Docker image...", "Creating container instance..."]);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Session is handled on server side, no need to pass userId
      const res = await fetch("/api/projects/create", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          template: projectData.template.id,
          name: projectData.name,
          description: projectData.description,
          techStack: [...projectData.template.techStack, ...projectData.customTechStack],
          createGithubRepo: true // Always create GitHub repo
        })
      });
      
      const data = await res.json();
      updateStep("1", "success", ["Container created successfully", `ID: ${data.projectId?.substring(0, 12)}...`]);

      if (!data.projectId) {
        throw new Error("Failed to create project");
      }

      // Step 2: Project structure
      updateStep("2", "running", ["Creating directory structure...", "Setting up configuration files..."]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep("2", "success", ["Project structure initialized", `Template: ${projectData.template.id}`]);

      // Step 3: Installing dependencies
      updateStep("3", "running", [
        "Running npm install...",
        "Resolving dependencies...",
        "This may take a few moments..."
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      updateStep("3", "success", ["Dependencies installed", "node_modules created"]);

      // Step 4: GitHub repo
      updateStep("4", "running", ["Creating GitHub repository...", "Setting up remote..."]);
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStep("4", "success", [`Repository: ${projectData.name}`, "Remote configured"]);

      // Step 5: Initial commit
      updateStep("5", "running", ["Staging files...", "Committing changes...", "Pushing to GitHub..."]);
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateStep("5", "success", ["Initial commit pushed", "Branch: main"]);

      // Step 6: Start server
      updateStep("6", "running", ["Starting development server...", "Waiting for port binding..."]);
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStep("6", "success", ["Development server started", "Ready for development"]);

      // Instant redirect - no waiting
      router.push(`/ide/${data.projectId}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setShowSetupTerminal(false);
      setIsCreating(false);
      alert("Failed to create project. Please try again.");
    }
  };

  const handleOpenProject = async (projectId: string) => {
    // Check if project needs to be resumed (no active container)
    const project = ongoingProjects.find(p => p.id === projectId);
    
    // If project has no container, show setup animation
    if (project && !project.containerId) {
      await handleResumeProject(projectId);
    } else {
      // Project container is running, just navigate
      router.push(`/ide/${projectId}`);
    }
  };

  const handleResumeProject = async (projectId: string) => {
    // Initialize setup steps for resuming
    const initialSteps: SetupStep[] = [
      { id: "1", label: "Creating project container", status: "pending" },
      { id: "2", label: "Cloning from GitHub repository", status: "pending" },
      { id: "3", label: "Installing dependencies", status: "pending" },
      { id: "4", label: "Setting up development environment", status: "pending" },
      { id: "5", label: "Starting development server", status: "pending" },
    ];
    
    setSetupSteps(initialSteps);
    setShowSetupTerminal(true);
    setIsCreating(true);
    
    try {
      // Helper to update step status
      const updateStep = (stepId: string, status: SetupStep["status"], output?: string[]) => {
        setSetupSteps(prev => prev.map(step => {
          if (step.id === stepId) {
            return {
              ...step,
              status,
              output,
              startTime: status === "running" ? Date.now() : step.startTime,
              endTime: status === "success" || status === "error" ? Date.now() : undefined,
            };
          }
          return step;
        }));
      };

      // Step 1: Create container
      updateStep("1", "running", ["Pulling Docker image...", "Creating container instance..."]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const res = await fetch(`/api/projects/${projectId}/resume`, {
        method: "POST",
      });

      const data = await res.json();

      if (!data.success) {
        updateStep("1", "error", [data.error || "Failed to create container"]);
        throw new Error(data.error || "Failed to resume project");
      }
      
      updateStep("1", "success", ["Container created successfully", `ID: ${projectId.substring(0, 12)}...`]);

      // Step 2: Clone from GitHub
      updateStep("2", "running", ["Fetching repository...", "Cloning project files..."]);
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateStep("2", "success", ["Repository cloned", "All files downloaded"]);

      // Step 3: Installing dependencies
      updateStep("3", "running", [
        "Running npm install...",
        "Resolving dependencies...",
        "This may take 1-2 minutes..."
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      updateStep("3", "success", ["Dependencies installed", "node_modules created"]);

      // Step 4: Setting up environment
      updateStep("4", "running", ["Configuring environment...", "Setting up Git..."]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep("4", "success", ["Environment configured", "Ready for development"]);

      // Step 5: Start server
      updateStep("5", "running", ["Starting development server...", "Waiting for port binding..."]);
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStep("5", "success", ["Development server started", "Project ready"]);

      // Reload projects to update status
      await loadOngoingProjects();
      
      // Instant redirect
      router.push(`/ide/${projectId}`);
    } catch (err) {
      console.error("Error resuming project:", err);
      setShowSetupTerminal(false);
      setIsCreating(false);
      alert("An error occurred while resuming the project.");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project? This will permanently delete the container and all files inside it.")) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/delete`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        // Reload the projects list
        await loadOngoingProjects();
        
        // Show success message (you can add a toast notification here)
        console.log("Project deleted successfully");
      } else {
        console.error("Failed to delete project:", data.error);
        alert("Failed to delete project. Please try again.");
      }
    } catch (err) {
      console.error("Error deleting project:", err);
      alert("An error occurred while deleting the project.");
    }
  };

  const difficulties = ["all", "Beginner", "Intermediate", "Advanced"];

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (will redirect)
  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <>
      {showSetupTerminal && (
        <SetupTerminal
          steps={setupSteps}
          title="Creating Your Project"
        />
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        {/* Header */}
        <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <Code2 className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold">QuantumIDE</h1>
                  <p className="text-sm text-muted-foreground">Cloud Development Environment</p>
                </div>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setShowLoadModal(true)}
                variant="default"
                size="sm"
              >
                <Globe className="w-4 h-4 mr-2" />
                Load from GitHub
              </Button>
              
              <Button 
                onClick={loadOngoingProjects}
                variant="outline" 
                size="sm"
                disabled={isLoadingProjects}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingProjects && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Ongoing Projects Section */}
        {ongoingProjects.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Continue Working</h2>
                <Badge variant="secondary">{ongoingProjects.length}</Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ongoingProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <OngoingProjectCard
                    project={project}
                    onOpenProject={handleOpenProject}
                    onDeleteProject={handleDeleteProject}
                    onResumeProject={handleResumeProject}
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {ongoingProjects.length > 0 && <Separator />}

        {/* Create New Project Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Plus className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Create New Project</h2>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-1">
                {difficulties.map((difficulty) => (
                  <Button
                    key={difficulty}
                    variant={selectedDifficulty === difficulty ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className="text-xs"
                  >
                    {difficulty === "all" ? "All" : difficulty}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Project Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <ProjectCard
                  template={template}
                  onCreateProject={handleCreateProject}
                  isCreating={isCreating && selectedTemplate?.id === template.id}
                />
              </motion.div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No templates found matching your criteria.</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedDifficulty("all");
                  }}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              </div>
            </motion.div>
          )}
        </motion.section>
      </div>

      {/* Project Creation Modal */}
      <ProjectCreationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        template={selectedTemplate}
        onCreateProject={handleConfirmCreateProject}
        isCreating={isCreating}
      />

      {/* Load Project from GitHub Modal */}
      <LoadProjectModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoadComplete={() => {
          setShowLoadModal(false);
          loadOngoingProjects();
        }}
      />
    </div>
    </>
  );
}