"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, X, Github } from "lucide-react";
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

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: ProjectTemplate | null;
  onCreateProject: (projectData: {
    name: string;
    description: string;
    template: ProjectTemplate;
    customTechStack: string[];
    createGithubRepo?: boolean;
  }) => void;
  isCreating: boolean;
}

export function ProjectCreationModal({ 
  isOpen, 
  onClose, 
  template, 
  onCreateProject, 
  isCreating 
}: ProjectCreationModalProps) {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [customTechStack, setCustomTechStack] = useState<string[]>([]);
  const [newTech, setNewTech] = useState("");
  const [createGithubRepo, setCreateGithubRepo] = useState(false);

  const handleAddTech = () => {
    if (newTech.trim() && !customTechStack.includes(newTech.trim())) {
      setCustomTechStack([...customTechStack, newTech.trim()]);
      setNewTech("");
    }
  };

  const handleRemoveTech = (tech: string) => {
    setCustomTechStack(customTechStack.filter(t => t !== tech));
  };

  const handleCreate = () => {
    if (!template || !projectName.trim()) return;
    
    onCreateProject({
      name: projectName.trim(),
      description: projectDescription.trim(),
      template,
      customTechStack,
      createGithubRepo
    });
  };

  const handleClose = () => {
    if (!isCreating) {
      setProjectName("");
      setProjectDescription("");
      setCustomTechStack([]);
      setNewTech("");
      setCreateGithubRepo(false);
      onClose();
    }
  };

  if (!template) return null;

  const allTechStack = [...template.techStack, ...customTechStack];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {template.icon}
            <span>Create {template.name} Project</span>
          </DialogTitle>
          <DialogDescription>
            Configure your new project settings and customize the tech stack.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name *</Label>
            <Input
              id="project-name"
              placeholder="my-awesome-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isCreating}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Describe your project..."
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              disabled={isCreating}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Tech Stack</Label>
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Default technologies:</div>
              <div className="flex flex-wrap gap-1">
                {template.techStack.map((tech) => (
                  <Badge key={tech} variant="default" className="text-xs">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>

            {customTechStack.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Additional technologies:</div>
                <div className="flex flex-wrap gap-1">
                  {customTechStack.map((tech) => (
                    <Badge 
                      key={tech} 
                      variant="secondary" 
                      className="text-xs group cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors duration-200"
                      onClick={() => !isCreating && handleRemoveTech(tech)}
                    >
                      {tech}
                      <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              <Input
                placeholder="Add technology (e.g., Redux, Express)"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddTech()}
                disabled={isCreating}
                className="flex-1"
              />
              <Button
                onClick={handleAddTech}
                disabled={!newTech.trim() || isCreating}
                size="sm"
                variant="outline"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium">Project Features:</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {template.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-1 h-1 bg-primary rounded-full mr-2" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* GitHub Integration */}
          <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="github-repo"
                checked={createGithubRepo}
                onCheckedChange={(checked) => setCreateGithubRepo(checked as boolean)}
                disabled={isCreating}
                className="mt-0.5"
              />
              <div className="space-y-1 flex-1">
                <Label 
                  htmlFor="github-repo" 
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  Create GitHub Repository
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically create a GitHub repo and push your project. Click 'Save to GitHub' button to commit and push changes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!projectName.trim() || isCreating}
            className={cn(
              "min-w-[120px] transition-all duration-200",
              isCreating && "animate-pulse"
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}