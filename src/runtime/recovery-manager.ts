export class RecoveryManager {
  async recover(workflowId: string) {
    return {
      workflowId,
      recovered: false
    };
  }
}
