export interface Goal {
  id: string;
  objective: string;
  constraints: string[];
  context: Record<string, unknown>;
}
