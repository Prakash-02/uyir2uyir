import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../../api/client'
import type { Call, BloodRequest, SimKey, CallState } from '../../api/types'
import { StatusBadge } from '../../components/StatusBadge'
import { Keypad } from '../../components/Keypad'
import { Button } from '../../components/Button'
import { useT } from '../../i18n/useT'
import {
  PhoneCall,
  PhoneIncoming,
  CheckCircle2,
  XCircle,
  Ban,
  Heart,
  MapPin,
  ExternalLink,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'

interface AnsweredResponse {
  callId: string
  donorAlias: string
  key: SimKey
  state: CallState
  centreName: string
}

export function SimPage() {
  const { t } = useT()
  const api = getApi()
  const navigate = useNavigate()

  // Ringing calls live from subscribeSimCalls
  const [ringingCalls, setRingingCalls] = useState<Call[]>([])
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)

  // Request details for selected call
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null)

  // App configuration (weather alert, etc.)
  const [weatherAlert, setWeatherAlert] = useState(false)

  // Simulation interaction state
  const [isPressing, setIsPressing] = useState(false)
  const [activePressedKey, setActivePressedKey] = useState<SimKey | null>(null)
  const [answeredResponse, setAnsweredResponse] = useState<AnsweredResponse | null>(null)
  const [isRunningStory, setIsRunningStory] = useState(false)

  // 1. Subscribe to calls currently RINGING across all requests
  useEffect(() => {
    const unsub = api.subscribeSimCalls((calls) => {
      setRingingCalls(calls)

      // Auto-select first ringing call if current selection is invalid or null
      setSelectedCallId((prevId) => {
        if (prevId && calls.some((c) => c.id === prevId)) {
          return prevId
        }
        return calls.length > 0 ? calls[0].id : null
      })
    })

    return () => unsub()
  }, [api])

  // 2. Fetch app config for weather alert flag
  useEffect(() => {
    let mounted = true
    api.getConfig()
      .then((cfg) => {
        if (mounted) {
          setWeatherAlert(Boolean(cfg.weatherAlert))
        }
      })
      .catch((err) => {
        console.error('Failed to load AppConfig in SimPage:', err)
      })
    return () => {
      mounted = false
    }
  }, [api])

  // 3. Find the currently active ringing call
  const activeCall = ringingCalls.find((c) => c.id === selectedCallId) ?? ringingCalls[0] ?? null

  // 4. Subscribe to the associated BloodRequest to resolve hospitalName, centreName, component
  useEffect(() => {
    if (!activeCall?.requestId) {
      return
    }

    const unsubReq = api.subscribeRequest(activeCall.requestId, (req) => {
      setSelectedRequest(req)
    })

    return () => unsubReq()
  }, [api, activeCall?.requestId])

  // Request field defaults
  const hospitalName = selectedRequest?.hospitalName || 'Sample General Hospital, Chennai'
  const centreName = selectedRequest?.centreName || 'Central Blood Bank, Egmore (Simulated)'
  const bloodGroup = selectedRequest?.bloodGroup || activeCall?.bloodGroup || 'O+'
  const component = selectedRequest?.component || 'RED_CELLS'

  // 5. Handle DTMF Keypress (1, 2, 9)
  const handlePressKey = async (key: SimKey) => {
    if (!activeCall || isPressing) return
    setIsPressing(true)
    setActivePressedKey(key)

    try {
      const updated = await api.simPressKey(activeCall.id, key)

      setAnsweredResponse({
        callId: updated.id,
        donorAlias: updated.donorAlias,
        key,
        state: updated.state,
        centreName,
      })
    } catch (err) {
      console.error('Failed to simulate key press:', err)
    } finally {
      setIsPressing(false)
      setActivePressedKey(null)
    }
  }

  // Handle Run Story button in empty state
  const handleRunStory = async () => {
    if (isRunningStory) return
    setIsRunningStory(true)
    try {
      await api.runScenario('story')
    } catch (err) {
      console.error('Failed to run story from SimPage:', err)
    } finally {
      setIsRunningStory(false)
    }
  }

  const donorLang = activeCall?.lang ?? 'en'

  const callScriptEnglish = `A patient at ${hospitalName} needs ${bloodGroup} ${component}.${
    weatherAlert ? ' If roads near you are unsafe because of rain, please press 2.' : ''
  } Press 1 if you can come in the next few hours. Press 2 if you can't. Press 9 to stop these calls.`

  const callScriptTamil = `${hospitalName}-ல் உள்ள ஒரு நோயாளிக்கு ${bloodGroup} ${component} தேவைப்படுகிறது.${
    weatherAlert ? ' மழை காரணமாக உங்கள் அருகிலுள்ள சாலைகள் பாதுகாப்பற்றதாக இருந்தால், தயவுசெய்து 2-ஐ அழுத்தவும்.' : ''
  } அடுத்த சில மணிநேரங்களில் வர முடிந்தால் 1-ஐ அழுத்தவும். வர இயலாவிட்டால் 2-ஐ அழுத்தவும். இந்த அழைப்புகளை நிறுத்த 9-ஐ அழுத்தவும்.`

  const currentCallScript = donorLang === 'ta' ? callScriptTamil : callScriptEnglish

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 5. Top Note: Demo Simulator Banner */}
      <div
        role="note"
        aria-live="polite"
        className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl bg-[var(--demo)]/15 border border-[var(--demo)]/40 text-[var(--text)] shadow-xs select-none"
      >
        <PhoneCall className="w-5 h-5 text-[var(--demo)] shrink-0" aria-hidden="true" />
        <p className="font-semibold text-xs sm:text-sm">
          Demo simulator. In the live system this is a real phone call.
        </p>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text)] tracking-tight">
          {t.sim.title}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {t.sim.subtitle}
        </p>
      </div>

      {/* Main Grid: Calls List on left, Phone Frame on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 1. List of Ringing Calls */}
        <section
          aria-labelledby="ringing-calls-title"
          className="lg:col-span-5 space-y-3 order-2 lg:order-1"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneIncoming className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
              <h2 id="ringing-calls-title" className="font-heading font-bold text-base sm:text-lg text-[var(--text)]">
                {t.sim.ringingCallsTitle}
              </h2>
            </div>
            <span
              aria-live="polite"
              className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--border)]/40 text-[var(--muted)]"
            >
              {ringingCalls.length} ringing
            </span>
          </div>

          {ringingCalls.length === 0 ? (
            /* Empty State: Prompt Step 1 Hint */
            <div
              role="status"
              className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-center space-y-4 shadow-xs"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--border)]/30 text-[var(--muted)] flex items-center justify-center mx-auto">
                <PhoneCall className="w-6 h-6 opacity-60" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-heading font-bold text-base text-[var(--text)]">
                  No active ringing calls
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Raise a request on the Hospital screen, or press Run the story.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => navigate('/hospital')}
                  className="w-full sm:w-auto text-xs min-h-[40px] px-3.5 py-1.5"
                >
                  {t.sim.openHospital}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRunStory}
                  isLoading={isRunningStory}
                  className="w-full sm:w-auto text-xs min-h-[40px] px-3.5 py-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current mr-1" aria-hidden="true" />
                  {t.sim.runStory}
                </Button>
              </div>
            </div>
          ) : (
            /* List of currently ringing calls */
            <div className="space-y-2.5">
              {ringingCalls.map((call) => {
                const isSelected = call.id === (activeCall?.id ?? selectedCallId)
                return (
                  <button
                    key={call.id}
                    type="button"
                    onClick={() => {
                      setSelectedCallId(call.id)
                      setAnsweredResponse(null)
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Select ringing call for ${call.donorAlias}, ${call.bloodGroup}`}
                    className={clsx(
                      'w-full p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer shadow-2xs focus-visible:outline-3 focus-visible:outline-[var(--info)]',
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--surface)] ring-2 ring-[var(--primary)]/20 shadow-xs'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border)]/80 hover:bg-[var(--border)]/10',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-heading font-bold text-xs tracking-tight border border-[var(--primary)]/20 shrink-0">
                        {call.bloodGroup}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-sm text-[var(--text)] truncate">
                            {call.donorAlias}
                          </span>
                          <span
                            lang={call.lang}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--border)]/50 text-[var(--muted)] uppercase"
                          >
                            {call.lang === 'ta' ? 'தமிழ்' : 'EN'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                          {call.distanceKm.toFixed(1)} km away · Round {call.round}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <StatusBadge status={call.state} kind="call" size="sm" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* 2 & 3 & 4. Phone Frame Card */}
        <section
          aria-label="Phone handset simulator"
          className="lg:col-span-7 flex justify-center order-1 lg:order-2"
        >
          <div className="w-full max-w-md bg-[var(--surface)] border-4 border-[var(--border)] rounded-[40px] p-6 sm:p-7 shadow-xl relative flex flex-col justify-between min-h-[580px]">
            {/* Phone Top Speaker & Notch */}
            <div className="flex flex-col items-center mb-5">
              <div className="w-20 h-3.5 bg-[var(--border)]/70 rounded-full" aria-hidden="true" />
              <div className="flex items-center gap-1.5 mt-2 text-[11px] font-mono text-[var(--muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" aria-hidden="true" />
                <span>U2U VOICE DISPATCH</span>
              </div>
            </div>

            {/* If no call is available and not in response state */}
            {!activeCall && !answeredResponse ? (
              <div className="my-auto text-center space-y-4 py-12">
                <div className="w-16 h-16 rounded-full bg-[var(--border)]/20 text-[var(--muted)] flex items-center justify-center mx-auto">
                  <PhoneCall className="w-8 h-8 opacity-40" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading font-bold text-lg text-[var(--text)]">
                    No active call selected
                  </h3>
                  <p className="text-sm text-[var(--muted)] max-w-xs mx-auto">
                    Select a ringing call from the list or trigger a demo request to simulate answering.
                  </p>
                </div>
              </div>
            ) : answeredResponse ? (
              /* 4. Response Screen After Pressing a Key */
              <div
                role="status"
                aria-live="polite"
                className="my-auto space-y-6 text-center py-6 animate-fade-in"
              >
                {/* Result Icon */}
                <div className="mx-auto flex justify-center">
                  {answeredResponse.state === 'LATE_ACCEPT' ? (
                    <div className="w-16 h-16 rounded-full bg-[var(--info-tint)] text-[var(--info)] flex items-center justify-center border border-[var(--info)]/30">
                      <Heart className="w-8 h-8 fill-current" aria-hidden="true" />
                    </div>
                  ) : answeredResponse.key === '1' ? (
                    <div className="w-16 h-16 rounded-full bg-[var(--success-tint)] text-[var(--success)] flex items-center justify-center border border-[var(--success)]/30">
                      <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
                    </div>
                  ) : answeredResponse.key === '2' ? (
                    <div className="w-16 h-16 rounded-full bg-[var(--border)]/40 text-[var(--muted)] flex items-center justify-center border border-[var(--border)]">
                      <XCircle className="w-8 h-8" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--danger-tint)] text-[var(--danger)] flex items-center justify-center border border-[var(--danger)]/30">
                      <Ban className="w-8 h-8" aria-hidden="true" />
                    </div>
                  )}
                </div>

                {/* Donor Identifier Tag */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--border)]/30 text-xs font-mono text-[var(--muted)]">
                  <span>{answeredResponse.donorAlias}</span>
                  <span>·</span>
                  <span>Key {answeredResponse.key} pressed</span>
                </div>

                {/* Verbatim Responses as Specified in Step 4 */}
                <div className="space-y-3 px-2">
                  {answeredResponse.state === 'LATE_ACCEPT' ? (
                    <div className="space-y-1">
                      <p className="font-heading font-bold text-xl sm:text-2xl text-[var(--text)] leading-snug">
                        Thank you, we already have enough donors.
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        Your willingness to help is deeply appreciated. Outreach was paused because enough volunteers responded first.
                      </p>
                    </div>
                  ) : answeredResponse.key === '1' ? (
                    <div className="space-y-2">
                      <p className="font-heading font-bold text-xl sm:text-2xl text-[var(--text)] leading-snug">
                        Thank you. Please go to {answeredResponse.centreName}.
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        The blood centre staff will screen you upon arrival.
                      </p>

                      {/* Map link placeholder */}
                      <div className="pt-2">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            answeredResponse.centreName,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--info-tint)] text-[var(--info)] text-xs sm:text-sm font-semibold hover:bg-[var(--info-tint)]/80 transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)]"
                        >
                          <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{t.sim.mapLink}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  ) : answeredResponse.key === '2' ? (
                    <div className="space-y-1">
                      <p className="font-heading font-bold text-xl sm:text-2xl text-[var(--text)] leading-snug">
                        Thank you for telling us.
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        We will reach out to another nearby volunteer in the donor pool.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-heading font-bold text-xl sm:text-2xl text-[var(--danger)] leading-snug">
                        You won't be called again.
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        Your phone number has been unsubscribed from the emergency automated pool.
                      </p>
                    </div>
                  )}
                </div>

                {/* Reset / Next action */}
                <div className="pt-4 border-t border-[var(--border)]/60 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAnsweredResponse(null)
                    }}
                    className="text-xs min-h-[42px] px-4 py-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                    <span>{t.sim.answerAnother}</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* 2 & 3. Incoming Call Active Screen: Script + Keypad */
              <div className="space-y-5 my-auto animate-fade-in">
                {/* Caller Information */}
                <div className="text-center space-y-1 pb-2 border-b border-[var(--border)]/60">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] animate-pulse" aria-hidden="true" />
                    <span className="font-heading font-bold text-lg sm:text-xl text-[var(--text)]">
                      {activeCall?.donorAlias}
                    </span>
                    <span
                      lang={donorLang}
                      className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--border)]/50 text-[var(--muted)] uppercase"
                    >
                      {donorLang === 'ta' ? 'தமிழ்' : 'English'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {t.sim.callIncoming} · {activeCall?.distanceKm.toFixed(1)} km away
                  </p>
                </div>

                {/* Weather alert banner inside phone if active */}
                {weatherAlert && (
                  <div className="p-2.5 rounded-xl bg-[var(--warning-tint)] border border-[var(--warning)]/20 text-[var(--warning)] text-xs flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Rain advisory active in dispatch audio script</span>
                  </div>
                )}

                {/* 2. The Call Script in large font in the donor's language */}
                <div
                  lang={donorLang}
                  className="p-4 sm:p-5 rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-2xs"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2 font-mono">
                    IVR Voice Prompt ({donorLang.toUpperCase()}):
                  </p>
                  <p className="text-base sm:text-lg font-heading font-semibold text-[var(--text)] leading-relaxed">
                    &ldquo;{currentCallScript}&rdquo;
                  </p>
                </div>

                {/* 3. The Keypad: 1 "I'm coming", 2 "I can't", 9 "Stop calling me" */}
                <div className="pt-2">
                  <Keypad
                    onPressKey={handlePressKey}
                    disabled={isPressing}
                    activeKey={activePressedKey}
                  />
                </div>
              </div>
            )}

            {/* Phone Bottom Home Bar */}
            <div className="mt-4 pt-3 flex justify-center">
              <div className="w-32 h-1 bg-[var(--border)] rounded-full" aria-hidden="true" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default SimPage
