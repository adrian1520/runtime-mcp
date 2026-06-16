export interface SessionState {
  sessionId: string;
  projectId: string;
  activeGoal?: string;
  loadedSkills: string[];
  loadedTools: string[];
  memoryRefs: string[];
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolDescriptor {
  id: string;
  version: string;
  category: 'memory' | 'repository' | 'python' | 'skill';
  enabled: boolean;
  description: string;
}

export interface SkillDescriptor {
  id: string;
  version: string;
  score: number;
  status: 'draft' | 'testing' | 'published';
}
