import type { ApiClient } from '../client'
import type { AppConfig, BloodRequest, DeskResult, Metrics, EvalResult } from '../types'

export class MockApiClient implements ApiClient {
  async getConfig(): Promise<AppConfig> {
    return {
      dataMode: 'demo',
      bannerText: 'SIMULATED DATA — All hospitals, donors and patients shown are simulated.',
      weatherAlert: false,
    }
  }

  async getMetrics(): Promise<Metrics> {
    return {
      requests: 0,
      medianMinutesToFirstOnTheWay: 0,
      medianMinutesToCovered: 0,
      medianMinutesToFulfilled: 0,
      baseline: { toFirstOnTheWay: 0, toCovered: 0, toFulfilled: 0 },
      callsPerAccepted: 0,
      standDownReachPct: 0,
      isSimulated: true,
    }
  }

  async getLatestEval(): Promise<EvalResult> {
    return {
      promptVersion: 'v1-demo',
      runAt: new Date().toISOString(),
      total: 0,
      correct: 0,
      paymentToHospital: 0,
      wrongHospitalIds: 0,
      p95LatencyMs: 0,
      rows: [],
    }
  }

  async checkDesk(_text: string): Promise<DeskResult> {
    return {
      answer: 'NOT_VERIFIED',
      message: "Couldn't verify. Please call the hospital.",
      footer: 'Nobody may charge you for a donor.',
      trace: {
        hospital: { value: null, quote: null, kept: false },
        patientNumber: { value: null, quote: null, kept: false },
        bloodGroup: { value: null, quote: null, kept: false },
        component: { value: null, quote: null, kept: false },
        units: { value: null, quote: null, kept: false },
        paymentPhrases: [],
        geminiChoice: 'NONE',
        codeDecision: 'NOT_VERIFIED',
      },
    }
  }

  async createRequest(data: Partial<BloodRequest>): Promise<BloodRequest> {
    return {
      id: 'req-mock-1',
      hospitalId: data.hospitalId ?? 'hosp-1',
      hospitalName: data.hospitalName ?? 'Kauvery Hospital',
      centreId: data.centreId ?? 'centre-1',
      centreName: data.centreName ?? 'Rotary Central Blood Bank',
      bloodGroup: data.bloodGroup ?? 'O+',
      component: data.component ?? 'RED_CELLS',
      unitsNeeded: data.unitsNeeded ?? 2,
      status: 'OPEN',
      accepted: 0,
      onTheWay: 0,
      round: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 4).toISOString(),
      isSimulated: true,
      patientRef: data.patientRef,
    }
  }
}

export const mockClient = new MockApiClient()
