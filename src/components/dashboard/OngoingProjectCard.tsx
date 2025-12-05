"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, FolderOpen, Calendar, Clock, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OngoingProject {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  lastModified: string;
  status: "running" | "stopped" | "error";
  containerPort?: number;
}

interface OngoingProjectCardProps {
  project: OngoingProject;
  onOpenProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onResumeProject?: (projectId: string) => void;
}

export function OngoingProjectCard({ project, onOpenProject, onDeleteProject, onResumeProject }: OngoingProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const handleOpen = async () => {
    // If project is stopped, resume it first
    if (project.status === 'stopped' && onResumeProject) {
      setIsResuming(true);
      try {
        await onResumeProject(project.id);
      } finally {
        setIsResuming(false);
      }
    } else {
      onOpenProject(project.id);
    }
  };

  const statusColors = {
    running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    stopped: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  };

  const statusDots = {
    running: "bg-green-500 animate-pulse",
    stopped: "bg-gray-500",
    error: "bg-red-500"
  };

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden border transition-all duration-300 ease-in-out cursor-pointer",
        "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10",
        isHovered && "border-primary/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors duration-200 truncate">
                {project.name || `Project ${project.id.slice(0, 8)}`}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground truncate">
                {project.description || "No description"}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className={cn("w-2 h-2 rounded-full", statusDots[project.status])} />
              <Badge 
                variant="secondary" 
                className={cn("text-xs", statusColors[project.status])}
              >
                {project.status}
              </Badge>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenProject(project.id)}>
                  Open Project
                </DropdownMenuItem>
                {onDeleteProject && (
                  <DropdownMenuItem 
                    onClick={() => onDeleteProject(project.id)}
                    className="text-red-600 dark:text-red-400"
                  >
                    Delete Project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <div className="flex flex-wrap gap-1">
            {project.techStack.map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            {project.lastModified}
          </div>
          {project.containerPort && (
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Port: {project.containerPort}
            </div>
          )}
        </div>

        <Button
          onClick={handleOpen}
          className="w-full group-hover:scale-105 transition-transform duration-200"
          size="sm"
          disabled={isResuming}
        >
          <Play className="w-4 h-4 mr-2" />
          {isResuming ? 'Resuming...' : project.status === 'stopped' ? 'Resume Project' : 'Open Project'}
        </Button>
      </CardContent>
    </Card>
  );
}