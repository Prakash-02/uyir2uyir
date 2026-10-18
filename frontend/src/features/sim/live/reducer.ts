/**
 * State machine and action reducer for Gemini Live calls on /sim.
 * Handles all protocol events received from WS /sim/live/{callId}.
 */

export interface TranscriptItem {
  id: string
  who: 'donor' | 'gemini'
  text: string
  timestamp: number
}

export interface LiveCallResult {
  intent: 'COMING' | 'CANT' | 'STOP' | 'UNCLEAR' | string
  etaMinutes: number | null
  quote: string
  applied: boolean
}

export interface LiveCallState {
  status: 'idle' | 'connecting' | 'connected' | 'ended' | 'error'
  isListening: boolean
  isSpeaking: boolean
  transcripts: TranscriptItem[]
  result: LiveCallResult | null
  fallbackReason: string | null
  micPermission: 'prompt' | 'granted' | 'denied'
  audioChunksReceived: number
  clearsReceived: number
  errorMessage: string | null
}

export const initialLiveCallState: LiveCallState = {
  status: 'idle',
  isListening: false,
  isSpeaking: false,
  transcripts: [],
  result: null,
  fallbackReason: null,
  micPermission: 'prompt',
  audioChunksReceived: 0,
  clearsReceived: 0,
  errorMessage: null,
}

export type LiveCallAction =
  | { type: 'START_CONNECTING' }
  | { type: 'CONNECTED' }
  | { type: 'MIC_GRANTED' }
  | { type: 'MIC_DENIED' }
  | { type: 'SERVER_AUDIO' }
  | { type: 'SERVER_TRANSCRIPT'; who: 'donor' | 'gemini'; text: string }
  | { type: 'SERVER_CLEAR' }
  | { type: 'SERVER_RESULT'; result: LiveCallResult }
  | { type: 'SERVER_FALLBACK'; reason: string }
  | { type: 'SERVER_ENDED' }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' }

export function liveCallReducer(
  state: LiveCallState,
  action: LiveCallAction,
): LiveCallState {
  switch (action.type) {
    case 'START_CONNECTING':
      return {
        ...state,
        status: 'connecting',
        errorMessage: null,
        fallbackReason: null,
        result: null,
        transcripts: [],
      }

    case 'CONNECTED':
      return {
        ...state,
        status: 'connected',
        isListening: true,
        isSpeaking: false,
      }

    case 'MIC_GRANTED':
      return {
        ...state,
        micPermission: 'granted',
      }

    case 'MIC_DENIED':
      return {
        ...state,
        micPermission: 'denied',
        status: 'error',
        errorMessage: 'Microphone blocked, please use the keypad',
      }

    case 'SERVER_AUDIO':
      return {
        ...state,
        audioChunksReceived: state.audioChunksReceived + 1,
        isSpeaking: true,
      }

    case 'SERVER_TRANSCRIPT': {
      if (!action.text || !action.text.trim()) {
        return state
      }
      const newItem: TranscriptItem = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        who: action.who,
        text: action.text.trim(),
        timestamp: Date.now(),
      }
      return {
        ...state,
        transcripts: [...state.transcripts, newItem],
      }
    }

    case 'SERVER_CLEAR':
      return {
        ...state,
        clearsReceived: state.clearsReceived + 1,
        isSpeaking: false,
        isListening: true,
      }

    case 'SERVER_RESULT':
      return {
        ...state,
        result: action.result,
      }

    case 'SERVER_FALLBACK':
      return {
        ...state,
        fallbackReason: action.reason,
        isListening: false,
        isSpeaking: false,
      }

    case 'SERVER_ENDED':
      return {
        ...state,
        status: 'ended',
        isListening: false,
        isSpeaking: false,
      }

    case 'ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.error,
        isListening: false,
        isSpeaking: false,
      }

    case 'RESET':
      return {
        ...initialLiveCallState,
      }

    default:
      return state
  }
}
