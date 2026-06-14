import type { RuntimeState } from "./types";

const ALLOWED: Record<RuntimeState, RuntimeState[]> = {
  DISCOVERY: ["PLANNING", "FAILED"],
  PLANNING: ["EXECUTION", "FAILED"],
  EXECUTION: ["VALIDATION", "FAILED"],
  VALIDATION: ["COMPLETE", "FAILED"],
  COMPLETE: [],
  FAILED: ["RECOVERY"],
  RECOVERY: ["EXECUTION", "FAILED"]
};

export class StateMachine {
  private state: RuntimeState = "DISCOVERY";

  get current(): RuntimeState {
    return this.state;
  }

  transition(next: RuntimeState): void {
    const allowed = ALLOWED[this.state];

    if (!allowed.includes(next)) {
      throw new Error(`Invalid transition ${this.state} -> ${next}`);
    }

    this.state = next;
  }
}
