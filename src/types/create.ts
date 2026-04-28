// create domain types
import type { TaskReasoningEffort } from "./task";

export type CreateProjectValues = {
  name: string;
  description?: string;
  repository?: string;
  visibility?: string;
  autoCreateRepo?: boolean;
  enableLocalTunnel?: boolean;
  localProjectPath?: string;
  frontendLocalPort?: string;
  apiLocalPort?: string;
  model?: string;
  reasoningEffort?: TaskReasoningEffort;
  fastMode?: boolean;
};

export type CreateTaskValues = {
  projectId?: string;
  type?: string;
  title: string;
  description: string;
  model?: string;
  reasoningEffort?: TaskReasoningEffort;
  planMode?: boolean;
  fastMode?: boolean;
};

