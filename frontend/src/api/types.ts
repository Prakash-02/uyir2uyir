export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type Component = 'WHOLE_BLOOD' | 'RED_CELLS' | 'PLATELETS_SDP' | 'PLATELETS_RDP' | 'PLASMA' | 'UNSPECIFIED';
export type RequestStatus = 'AWAITING_HOSPITAL' | 'OPEN' | 'PAUSED' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED' | 'REJECTED';
export type CallState =
  | 'QUEUED'
  | 'DIALING'
  | 'RINGING'
  | 'ON_THE_WAY'
  | 'ACCEPTED'
  | 'DEFERRED'
  | 'DECLINED'
  | 'NO_ANSWER'
  | 'UNKNOWN'
  | 'OPTED_OUT'
  | 'LATE_ACCEPT'
  | 'CANCELLED';
export type Lang = 'en' | 'ta';

export interface AppConfig {
  dataMode: 'demo' | 'live';
  bannerText: string | null;
  weatherAlert: boolean;
}

export interface BloodRequest {
  id: string;
  hospitalId: string;
  hospitalName: string;
  centreId: string;
  centreName: string;
  bloodGroup: BloodGroup;
  component: Component;
  unitsNeeded: number;
  status: RequestStatus;
  accepted: number;
  onTheWay: number;
  round: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isSimulated: boolean;
  patientRef?: string;
}

export interface Call {
  id: string;
  requestId: string;
  donorAlias: string;
  bloodGroup: BloodGroup;
  lang: Lang;
  state: CallState;
  round: number;
  etaMinutes: number | null;
  quote?: string | null;
  distanceKm: number;
  updatedAt: string;
}

export type PublicStatus = Pick<BloodRequest, 'id' | 'hospitalName' | 'bloodGroup' | 'component' | 'status'>;
export type ConfirmAction = 'RAISE' | 'NOT_OUR_PATIENT';
export type SimKey = '1' | '2' | '9';

export interface RequestPreview {
  hospitalName: string;
  bloodGroup: BloodGroup;
  component: Component;
  unitsNeeded: number;
  patientRefMasked: string;
  expiresAt: string;
}

export interface TimelineEvent {
  id: string;
  requestId: string;
  at: string;
  kind: string;
  text: string;
}

export interface QuotedField<T> {
  value: T | null;
  quote: string | null;
  kept: boolean;
}

export interface DeskResult {
  answer: 'VERIFIED_MATCH' | 'SENT_TO_HOSPITAL' | 'NOT_VERIFIED';
  message: string;
  requestId?: string;
  hospitalName?: string;
  trace: {
    inputType?: 'text' | 'image';
    transcript?: string;
    hospital: QuotedField<string>;
    patientNumber: QuotedField<string>;
    bloodGroup: QuotedField<BloodGroup>;
    component: QuotedField<Component>;
    units: QuotedField<number>;
    paymentPhrases: string[];
    geminiChoice: string;
    codeDecision: string;
  };
  footer: 'Nobody may charge you for a donor.';
  demoConfirmToken?: string;
}

export interface Metrics {
  requests: number;
  medianMinutesToFirstOnTheWay: number;
  medianMinutesToCovered: number;
  medianMinutesToFulfilled: number;
  baseline: { toFirstOnTheWay: number; toCovered: number; toFulfilled: number };
  callsPerAccepted: number;
  standDownReachPct: number;
  isSimulated: boolean;
}

export interface EvalResult {
  promptVersion: string;
  runAt: string;
  total: number;
  correct: number;
  paymentToHospital: number;
  wrongHospitalIds: number;
  p95LatencyMs: number;
  rows: { id: string; expected: string; got: string; pass: boolean }[];
}
