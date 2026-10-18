import { describe, it, expect } from 'vitest'
import {
  liveCallReducer,
  initialLiveCallState,
  type LiveCallResult,
} from './reducer'

describe('liveCallReducer handles every message type', () => {
  it('handles START_CONNECTING', () => {
    const next = liveCallReducer(initialLiveCallState, { type: 'START_CONNECTING' })
    expect(next.status).toBe('connecting')
    expect(next.errorMessage).toBeNull()
  })

  it('handles CONNECTED', () => {
    const next = liveCallReducer(
      { ...initialLiveCallState, status: 'connecting' },
      { type: 'CONNECTED' },
    )
    expect(next.status).toBe('connected')
    expect(next.isListening).toBe(true)
    expect(next.isSpeaking).toBe(false)
  })

  it('handles MIC_GRANTED and MIC_DENIED', () => {
    const granted = liveCallReducer(initialLiveCallState, { type: 'MIC_GRANTED' })
    expect(granted.micPermission).toBe('granted')

    const denied = liveCallReducer(initialLiveCallState, { type: 'MIC_DENIED' })
    expect(denied.micPermission).toBe('denied')
    expect(denied.status).toBe('error')
    expect(denied.errorMessage).toMatch(/Microphone blocked/i)
  })

  it('handles SERVER_AUDIO', () => {
    const next = liveCallReducer(
      { ...initialLiveCallState, status: 'connected', audioChunksReceived: 2 },
      { type: 'SERVER_AUDIO' },
    )
    expect(next.audioChunksReceived).toBe(3)
    expect(next.isSpeaking).toBe(true)
  })

  it('handles SERVER_TRANSCRIPT for donor and gemini', () => {
    let state = liveCallReducer(initialLiveCallState, {
      type: 'SERVER_TRANSCRIPT',
      who: 'donor',
      text: 'Varen 20 mins la',
    })
    expect(state.transcripts).toHaveLength(1)
    expect(state.transcripts[0].who).toBe('donor')
    expect(state.transcripts[0].text).toBe('Varen 20 mins la')

    state = liveCallReducer(state, {
      type: 'SERVER_TRANSCRIPT',
      who: 'gemini',
      text: 'Romba nandri',
    })
    expect(state.transcripts).toHaveLength(2)
    expect(state.transcripts[1].who).toBe('gemini')
    expect(state.transcripts[1].text).toBe('Romba nandri')
  })

  it('handles SERVER_CLEAR', () => {
    const speakingState = {
      ...initialLiveCallState,
      status: 'connected' as const,
      isSpeaking: true,
      isListening: false,
      clearsReceived: 0,
    }
    const next = liveCallReducer(speakingState, { type: 'SERVER_CLEAR' })
    expect(next.clearsReceived).toBe(1)
    expect(next.isSpeaking).toBe(false)
    expect(next.isListening).toBe(true)
  })

  it('handles SERVER_RESULT', () => {
    const result: LiveCallResult = {
      intent: 'COMING',
      etaMinutes: 20,
      quote: 'varen',
      applied: true,
    }
    const next = liveCallReducer(initialLiveCallState, {
      type: 'SERVER_RESULT',
      result,
    })
    expect(next.result).toEqual(result)
  })

  it('handles SERVER_FALLBACK', () => {
    const next = liveCallReducer(
      { ...initialLiveCallState, status: 'connected', isListening: true },
      { type: 'SERVER_FALLBACK', reason: 'connection_failed' },
    )
    expect(next.fallbackReason).toBe('connection_failed')
    expect(next.isListening).toBe(false)
  })

  it('handles SERVER_ENDED', () => {
    const next = liveCallReducer(
      { ...initialLiveCallState, status: 'connected', isListening: true },
      { type: 'SERVER_ENDED' },
    )
    expect(next.status).toBe('ended')
    expect(next.isListening).toBe(false)
    expect(next.isSpeaking).toBe(false)
  })

  it('handles ERROR and RESET', () => {
    const err = liveCallReducer(initialLiveCallState, {
      type: 'ERROR',
      error: 'WebSocket timeout',
    })
    expect(err.status).toBe('error')
    expect(err.errorMessage).toBe('WebSocket timeout')

    const reset = liveCallReducer(err, { type: 'RESET' })
    expect(reset).toEqual(initialLiveCallState)
  })
})
