"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const [ongoingProjects, setOngoingProjects] = useState<OngoingProject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof PROJECT_TEMPLATES[0] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  
  const router = useRouter();

  // Load ongoing projects
  useEffect(() => {
    loadOngoingProjects();
  }, []);

  const loadOngoingProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch("/api/projects/list");
      const data = await res.json();
      
      if (data.projects) {
        const formattedProjects: OngoingProject[] = data.projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          techStack: project.techStack,
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
    setIsCreating(true);
    setShowModal(false); // Close modal before showing loading screen
    
    try {
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
          createGithubRepo: projectData.createGithubRepo || false
        })
      });
      
      const data = await res.json();

      if (data.projectId) {
        router.push(`/ide/${data.projectId}`);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
      setIsCreating(false);
    }
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/ide/${projectId}`);
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

  return (
    <>
      {isCreating && (
        <ProjectLoading 
          status="installing" 
          message="Creating your project container and installing dependencies..."
          percentage={45}
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