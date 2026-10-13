import type { ApiClient } from '../client'
import type { AppConfig, BloodRequest, DeskResult, Metrics, EvalResult } from '../types'

export class HttpApiClient implements ApiClient {
  private baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
  }

  async getConfig(): Promise<AppConfig> {
    const res = await fetch(`${this.baseUrl}/config`)
    return res.json()
  }

  async getMetrics(): Promise<Metrics> {
    const res = await fetch(`${this.baseUrl}/metrics`)
    return res.json()
  }

  async getLatestEval(): Promise<EvalResult> {
    const res = await fetch(`${this.baseUrl}/eval/latest`)
    return res.json()
  }

  async checkDesk(text: string): Promise<DeskResult> {
    const res = await fetch(`${this.baseUrl}/desk/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return res.json()
  }

  async createRequest(data: Partial<BloodRequest>): Promise<BloodRequest> {
    const res = await fetch(`${this.baseUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  }
}

export const httpClient = new HttpApiClient()
