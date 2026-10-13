import type { AppConfig, BloodRequest, DeskResult, Metrics, EvalResult } from './types'

export interface ApiClient {
  getConfig(): Promise<AppConfig>;
  getMetrics(): Promise<Metrics>;
  getLatestEval(): Promise<EvalResult>;
  checkDesk(text: string): Promise<DeskResult>;
  createRequest(data: Partial<BloodRequest>): Promise<BloodRequest>;
}
