import { useEffect, useReducer, useRef, useCallback } from 'react'
import {
  liveCallReducer,
  initialLiveCallState,
  type LiveCallState,
} from './reducer'
import {
  getOrCreateAudioContext,
  PcmPlaybackQueue,
  startMicrophoneCapture,
  type MicCaptureHandle,
} from './audio'
import { getAuthToken } from '../../../lib/firebase'

export function getLiveWebSocketUrl(callId: string): string {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
  if (baseUrl) {
    const wsBase = baseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
    return `${wsBase.replace(/\/+$/, '')}/sim/live/${callId}`
  }
  const protocol =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000'
  return `${protocol}//${host}/sim/live/${callId}`
}

export interface UseLiveCallReturn {
  state: LiveCallState
  startCall: () => Promise<void>
  sendKey: (digit: '1' | '2' | '9') => void
  endCall: () => void
  resetCall: () => void
}

export function useLiveCall(callId: string | null): UseLiveCallReturn {
  const [state, dispatch] = useReducer(liveCallReducer, initialLiveCallState)

  const wsRef = useRef<WebSocket | null>(null)
  const micHandleRef = useRef<MicCaptureHandle | null>(null)
  const playbackQueueRef = useRef<PcmPlaybackQueue | null>(null)
  const activeCallIdRef = useRef<string | null>(callId)

  useEffect(() => {
    activeCallIdRef.current = callId
  }, [callId])

  const cleanup = useCallback(() => {
    if (micHandleRef.current) {
      micHandleRef.current.stop()
      micHandleRef.current = null
    }
    if (playbackQueueRef.current) {
      playbackQueueRef.current.destroy()
      playbackQueueRef.current = null
    }
    if (wsRef.current) {
      try {
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close()
        }
      } catch {
        // Socket close error ignored during cleanup
      }
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const startCall = useCallback(async () => {
    if (!activeCallIdRef.current) return
    const targetCallId = activeCallIdRef.current

    cleanup()
    dispatch({ type: 'START_CONNECTING' })

    // 1. Web Audio tap-to-create / resume (Safari iOS requirement)
    let audioCtx: AudioContext
    try {
      audioCtx = getOrCreateAudioContext()
    } catch {
      dispatch({
        type: 'ERROR',
        error: 'Web Audio is not supported in this browser.',
      })
      return
    }

    // 2. Microphone access
    let micHandle: MicCaptureHandle
    try {
      micHandle = await startMicrophoneCapture(audioCtx, (pcm16kBase64) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              pcm16k: pcm16kBase64,
            }),
          )
        }
      })
      micHandleRef.current = micHandle
      dispatch({ type: 'MIC_GRANTED' })
    } catch (err: unknown) {
      console.warn('Microphone permission denied or blocked:', err)
      dispatch({ type: 'MIC_DENIED' })
      return
    }

    // 3. Playback queue initialization
    const playbackQueue = new PcmPlaybackQueue(audioCtx)
    playbackQueueRef.current = playbackQueue

    // 4. Token & WebSocket initialization
    try {
      const token =
        (await getAuthToken(true)) ||
        localStorage.getItem('u2u_mock_token') ||
        'demo-id-token'

      const wsUrl = getLiveWebSocketUrl(targetCallId)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // Send initial auth message
        ws.send(
          JSON.stringify({
            type: 'auth',
            idToken: token,
          }),
        )
        dispatch({ type: 'CONNECTED' })
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          switch (msg.type) {
            case 'audio':
              if (msg.pcm24k) {
                playbackQueue.enqueue(msg.pcm24k)
                dispatch({ type: 'SERVER_AUDIO' })
              }
              break

            case 'transcript':
              dispatch({
                type: 'SERVER_TRANSCRIPT',
                who: msg.who === 'gemini' ? 'gemini' : 'donor',
                text: msg.text,
              })
              break

            case 'clear':
              playbackQueue.clear()
              dispatch({ type: 'SERVER_CLEAR' })
              break

            case 'result':
              dispatch({
                type: 'SERVER_RESULT',
                result: {
                  intent: msg.intent,
                  etaMinutes: msg.etaMinutes ?? null,
                  quote: msg.quote ?? '',
                  applied: Boolean(msg.applied),
                },
              })
              break

            case 'fallback':
              playbackQueue.clear()
              dispatch({ type: 'SERVER_FALLBACK', reason: msg.reason || 'unspecified' })
              break

            case 'ended':
              playbackQueue.clear()
              dispatch({ type: 'SERVER_ENDED' })
              cleanup()
              break

            default:
              break
          }
        } catch (err) {
          console.debug('Failed parsing incoming Live WS message:', err)
        }
      }

      ws.onerror = () => {
        dispatch({
          type: 'ERROR',
          error: "Gemini isn't available right now, please use the keypad.",
        })
        cleanup()
      }

      ws.onclose = () => {
        dispatch({ type: 'SERVER_ENDED' })
        cleanup()
      }
    } catch {
      dispatch({
        type: 'ERROR',
        error: "Gemini isn't available right now, please use the keypad.",
      })
      cleanup()
    }
  }, [cleanup])

  const sendKey = useCallback((digit: '1' | '2' | '9') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'key',
            digit,
          }),
        )
      } catch (err) {
        console.warn('Failed sending key over Live WS:', err)
      }
    }
    if (playbackQueueRef.current) {
      playbackQueueRef.current.clear()
    }
  }, [])

  const endCall = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'end' }))
      } catch {
        // Error on end ignored
      }
    }
    dispatch({ type: 'SERVER_ENDED' })
    cleanup()
  }, [cleanup])

  const resetCall = useCallback(() => {
    cleanup()
    dispatch({ type: 'RESET' })
  }, [cleanup])

  return {
    state,
    startCall,
    sendKey,
    endCall,
    resetCall,
  }
}
