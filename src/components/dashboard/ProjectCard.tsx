"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Calendar, Code, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  techStack: string[];
  features: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
}

interface ProjectCardProps {
  template: ProjectTemplate;
  onCreateProject: (template: ProjectTemplate) => void;
  isCreating: boolean;
}

export function ProjectCard({ template, onCreateProject, isCreating }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const difficultyColors = {
    Beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    Intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    Advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  };

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden border-2 transition-all duration-300 ease-in-out cursor-pointer",
        "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/20",
        isHovered && "border-primary/50",
        isCreating && "pointer-events-none opacity-75"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
              {template.icon}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors duration-200">
                {template.name}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {template.description}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={cn("text-xs", difficultyColors[template.difficulty])}
          >
            {template.difficulty}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center">
            <Code className="w-4 h-4 mr-1" />
            Tech Stack
          </h4>
          <div className="flex flex-wrap gap-1">
            {template.techStack.map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Features</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {template.features.map((feature, index) => (
              <li key={index} className="flex items-center">
                <span className="w-1 h-1 bg-primary rounded-full mr-2" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 mr-1" />
            {template.estimatedTime}
          </div>
          <Button
            onClick={() => onCreateProject(template)}
            disabled={isCreating}
            className="group-hover:scale-105 transition-transform duration-200"
            size="sm"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Project
                <ExternalLink className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}