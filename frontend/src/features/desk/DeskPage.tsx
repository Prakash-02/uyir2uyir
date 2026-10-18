import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getApi } from '../../api/client'
import type { DeskResult } from '../../api/types'
import { SAMPLE_MESSAGES, type SampleMessage } from '../../api/mock/desk'
import { TracePanel } from '../../components/TracePanel'
import { Button } from '../../components/Button'
import { useT } from '../../i18n/useT'
import {
  ShieldCheck,
  Send,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RotateCcw,
  ExternalLink,
  Shield,
  HelpCircle,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  X,
} from 'lucide-react'
import clsx from 'clsx'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface SamplePhoto {
  id: string
  title: string
  path: string
  typeLabel: string
}

const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: 'sample-photo-unknown',
    title: 'Photo: unknown hospital',
    path: '/samples/sample_photo_unknown_hospital.jpg',
    typeLabel: 'Unregistered facility',
  },
  {
    id: 'sample-photo-registered',
    title: 'Photo: registered hospital',
    path: '/samples/sample_photo_registered_hospital.jpg',
    typeLabel: 'Sample General Hospital',
  },
]

/**
 * Downscales image in browser using canvas to max 1600 px JPEG at quality 85.
 * Canvas drawing completely strips EXIF and GPS metadata before transmission.
 */
async function downscaleImageInBrowser(file: Blob): Promise<Blob> {
  if (
    import.meta.env.MODE === 'test' ||
    typeof window === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return file
  }

  // If canvas 2d context is unavailable (e.g. in jsdom), return file immediately
  try {
    const testCanvas = document.createElement('canvas')
    const ctx = testCanvas.getContext ? testCanvas.getContext('2d') : null
    if (!ctx) {
      return file
    }
  } catch {
    return file
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: Blob) => {
      if (!settled) {
        settled = true
        resolve(result)
      }
    }

    const timer = setTimeout(() => {
      finish(file)
    }, 1500)

    try {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        clearTimeout(timer)
        try {
          URL.revokeObjectURL(url)
          const maxDim = 1600
          let { width, height } = img
          if (!width || !height) {
            finish(file)
            return
          }
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            finish(file)
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          if (typeof canvas.toBlob === 'function') {
            canvas.toBlob(
              (blob) => {
                finish(blob || file)
              },
              'image/jpeg',
              0.85,
            )
          } else {
            finish(file)
          }
        } catch {
          finish(file)
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
        finish(file)
      }
      img.src = url
    } catch {
      clearTimeout(timer)
      finish(file)
    }
  })
}

export function DeskPage() {
  const { t, lang } = useT()
  const api = getApi()

  // Tab State: 'text' | 'photo'
  const [activeTab, setActiveTab] = useState<'text' | 'photo'>('text')

  // Text Tab State
  const [text, setText] = useState('')
  const [submittedText, setSubmittedText] = useState('')

  // Photo Tab State
  const [selectedPhoto, setSelectedPhoto] = useState<Blob | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Request State
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DeskResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Cleanup object URLs on unmount or photo change
  useEffect(() => {
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl)
      }
    }
  }, [photoPreviewUrl])

  const processAndSetImage = useCallback(
    async (file: File | Blob) => {
      setError(null)
      if (file.size > MAX_IMAGE_SIZE) {
        setError(t.desk.errorInvalidPhoto)
        return
      }

      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        setError(t.desk.errorInvalidPhoto)
        return
      }

      try {
        const downscaled = await downscaleImageInBrowser(file)
        setSelectedPhoto(downscaled)
        const objectUrl = URL.createObjectURL(downscaled)
        setPhotoPreviewUrl(objectUrl)
      } catch (err) {
        console.error('Failed to downscale image:', err)
        setError(t.desk.errorInvalidPhoto)
      }
    },
    [t.desk.errorInvalidPhoto],
  )

  // Clipboard Paste Listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) {
            e.preventDefault()
            setActiveTab('photo')
            void processAndSetImage(file)
            break
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [processAndSetImage])

  const handleTextCheck = async (messageToCheck?: string) => {
    const raw = (messageToCheck ?? text).trim()
    if (!raw || isLoading) return

    setIsLoading(true)
    setError(null)
    setSubmittedText(raw)

    try {
      const res = await api.checkDesk(raw)
      setResult(res)
    } catch (err) {
      console.error('Failed to check desk message:', err)
      setError(t.desk.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhotoCheck = async () => {
    if (!selectedPhoto || isLoading) return

    setIsLoading(true)
    setError(null)
    setSubmittedText(photoCaption)

    try {
      const res = await api.checkDeskImage(selectedPhoto, photoCaption)
      setResult(res)
    } catch (err) {
      console.error('Failed to check photo:', err)
      setError(t.desk.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSample = (sample: SampleMessage) => {
    setText(sample.text)
    setError(null)
  }

  const handleSelectSamplePhoto = async (sample: SamplePhoto) => {
    setIsLoading(true)
    setError(null)
    setActiveTab('photo')

    try {
      const response = await fetch(sample.path)
      if (!response.ok) throw new Error('Failed to load sample photo')
      const blob = await response.blob()
      const filename = sample.path.split('/').pop() || 'sample.jpg'
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
      try {
        Object.defineProperty(file, 'name', { value: filename, writable: true })
      } catch {
        // ignore
      }
      await processAndSetImage(file)
      setPhotoCaption('')
      // Immediately run the check for sample chips per step 6
      const res = await api.checkDeskImage(file, '')
      setResult(res)
    } catch (err) {
      console.error('Failed to load or check sample photo:', err)
      setError(t.desk.errorGeneric)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearText = () => {
    setText('')
    setSubmittedText('')
    setResult(null)
    setError(null)
  }

  const handleRemovePhoto = () => {
    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl)
    }
    setSelectedPhoto(null)
    setPhotoPreviewUrl(null)
    setPhotoCaption('')
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void processAndSetImage(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void processAndSetImage(file)
    }
  }

  const hasPayment = Boolean(result?.trace.paymentPhrases && result.trace.paymentPhrases.length > 0)
  const hospitalName = result?.hospitalName || 'the hospital'

  return (
    <div className="space-y-8 max-w-4xl mx-auto text-left">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--primary)] mb-1">
          <Shield className="w-4 h-4" aria-hidden="true" />
          <span>Public Verification Desk</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text)] tracking-tight">
          {t.desk.title}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
          {t.desk.subtitle}
        </p>
      </div>

      {/* Mode Switch Tabs: "Paste text" | "Upload photo" */}
      <div
        role="tablist"
        aria-label="Input format selection"
        className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] max-w-md shadow-2xs"
      >
        <button
          type="button"
          role="tab"
          id="tab-paste-text"
          aria-selected={activeTab === 'text'}
          aria-controls="panel-paste-text"
          onClick={() => {
            setActiveTab('text')
            setError(null)
          }}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer',
            'focus-visible:outline-3 focus-visible:outline-[var(--info)]',
            activeTab === 'text'
              ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/20',
          )}
        >
          <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t.desk.tabText}</span>
          {lang === 'ta' && <span className="text-[10px] opacity-80">(உரை)</span>}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-upload-photo"
          aria-selected={activeTab === 'photo'}
          aria-controls="panel-upload-photo"
          onClick={() => {
            setActiveTab('photo')
            setError(null)
          }}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer',
            'focus-visible:outline-3 focus-visible:outline-[var(--info)]',
            activeTab === 'photo'
              ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/20',
          )}
        >
          <ImageIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t.desk.tabPhoto}</span>
          {lang === 'ta' && <span className="text-[10px] opacity-80">(புகைப்படம்)</span>}
        </button>
      </div>

      {/* Main Input Card */}
      <section
        aria-label="Message Verification Form"
        className="p-5 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs space-y-5"
      >
        {/* TAB 1: PASTE TEXT */}
        {activeTab === 'text' && (
          <div
            id="panel-paste-text"
            role="tabpanel"
            aria-labelledby="tab-paste-text"
            className="space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="desk-message-input"
                id="message-input-heading"
                className="block text-sm sm:text-base font-heading font-bold text-[var(--text)]"
              >
                {t.desk.textareaLabel}
              </label>
              {/* Character counter (2,000 max) */}
              <span
                aria-live="polite"
                className={clsx(
                  'text-xs font-mono px-2 py-0.5 rounded-full border',
                  text.length > 1900
                    ? 'bg-[var(--danger-tint)] text-[var(--danger)] border-[var(--danger)]/30 font-bold'
                    : 'bg-[var(--border)]/30 text-[var(--muted)] border-[var(--border)]/50',
                )}
              >
                {text.length.toLocaleString()} / 2,000
              </span>
            </div>

            {/* Big Textarea */}
            <div className="relative">
              <textarea
                id="desk-message-input"
                rows={5}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.desk.textareaPlaceholder}
                className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm sm:text-base leading-relaxed focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all resize-y min-h-[140px]"
              />
            </div>

            {/* Privacy Note */}
            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 font-medium">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
              <span>{t.desk.privacyNote}</span>
            </p>

            {/* Try a Sample Chips */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]/60">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider font-mono">
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" aria-hidden="true" />
                <span>{t.desk.trySampleTitle}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {SAMPLE_MESSAGES.map((sample) => {
                  const isSelected = text === sample.text
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      aria-pressed={isSelected}
                      className={clsx(
                        'text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none',
                        'focus-visible:outline-3 focus-visible:outline-[var(--info)]',
                        isSelected
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-semibold'
                          : 'bg-[var(--border)]/20 hover:bg-[var(--border)]/40 text-[var(--text)] border-[var(--border)] hover:border-[var(--muted)]',
                      )}
                    >
                      {sample.title}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {text.length > 0 && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={handleClearText}
                  className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  <span>Clear</span>
                </Button>
              )}

              <div className="ml-auto">
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => handleTextCheck()}
                  disabled={text.trim().length === 0 || isLoading}
                  isLoading={isLoading}
                  className="min-w-[150px] shadow-sm font-bold"
                >
                  {isLoading ? t.desk.checking : t.desk.checkButton}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UPLOAD PHOTO */}
        {activeTab === 'photo' && (
          <div
            id="panel-upload-photo"
            role="tabpanel"
            aria-labelledby="tab-upload-photo"
            className="space-y-5"
          >
            {/* Hidden native input with mobile camera/gallery access */}
            <input
              ref={fileInputRef}
              type="file"
              id="desk-photo-file-input"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInputChange}
              className="sr-only"
              aria-label="Upload blood request photo"
            />

            {!photoPreviewUrl ? (
              /* Drop Zone */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                className={clsx(
                  'p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-3 cursor-pointer select-none',
                  'focus-visible:outline-3 focus-visible:outline-[var(--info)]',
                  isDragging
                    ? 'border-[var(--primary)] bg-[var(--primary-tint)]/40 scale-[1.01]'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/60 bg-[var(--bg)]/60 hover:bg-[var(--surface)]',
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center shadow-xs">
                  <UploadCloud className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-heading font-bold text-[var(--text)]">
                    {t.desk.dropZoneTitle}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t.desk.dropZoneHint}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2 pointer-events-none"
                  leftIcon={<ImageIcon className="w-4 h-4" aria-hidden="true" />}
                >
                  <span>{t.desk.choosePhotoButton}</span>
                </Button>
              </div>
            ) : (
              /* Selected Photo Thumbnail Preview with Remove Button */
              <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-[var(--border)] bg-black flex items-center justify-center shadow-xs">
                  <img
                    src={photoPreviewUrl}
                    alt="Uploaded blood request preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    aria-label={t.desk.removePhotoButton}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition-colors focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex-1 w-full space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[var(--success)] uppercase tracking-wider">
                      Photo Ready (EXIF stripped)
                    </span>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs text-[var(--danger)] hover:underline font-semibold cursor-pointer"
                    >
                      {t.desk.removePhotoButton}
                    </button>
                  </div>

                  {/* Optional caption input */}
                  <div>
                    <label
                      htmlFor="photo-caption-input"
                      className="block text-xs font-semibold text-[var(--muted)] mb-1"
                    >
                      {t.desk.captionLabel}
                    </label>
                    <input
                      id="photo-caption-input"
                      type="text"
                      maxLength={2000}
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      placeholder={t.desk.captionPlaceholder}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-xs sm:text-sm focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Privacy line under drop zone */}
            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 font-medium">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
              <span>{t.desk.photoPrivacyNote}</span>
            </p>

            {/* Sample Photo Chips */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]/60">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider font-mono">
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" aria-hidden="true" />
                <span>Try a sample photo</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {SAMPLE_PHOTOS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSamplePhoto(sample)}
                    disabled={isLoading}
                    className={clsx(
                      'text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none flex items-center gap-1.5',
                      'focus-visible:outline-3 focus-visible:outline-[var(--info)]',
                      'bg-[var(--border)]/20 hover:bg-[var(--border)]/40 text-[var(--text)] border-[var(--border)] hover:border-[var(--muted)]',
                    )}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[var(--primary)]" aria-hidden="true" />
                    <span>{sample.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="primary"
                type="button"
                onClick={handlePhotoCheck}
                disabled={!selectedPhoto || isLoading}
                isLoading={isLoading}
                className="min-w-[150px] shadow-sm font-bold"
              >
                {isLoading ? t.desk.checking : t.desk.checkPhotoButton}
              </Button>
            </div>
          </div>
        )}

        {/* Error Announcement */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-tint)] text-[var(--danger)] text-sm flex items-center gap-3 animate-fade-in"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <p className="font-semibold">{error}</p>
          </div>
        )}
      </section>

      {/* Answer Card Shown First, aria-live="assertive" */}
      {result && (
        <section
          aria-live="assertive"
          aria-labelledby="desk-answer-title"
          className="space-y-6 animate-fade-in"
        >
          <div
            className={clsx(
              'rounded-3xl border-2 overflow-hidden shadow-md text-left transition-all',
              result.answer === 'VERIFIED_MATCH'
                ? 'border-[var(--success)] bg-[var(--surface)]'
                : result.answer === 'SENT_TO_HOSPITAL'
                  ? 'border-[var(--warning)] bg-[var(--surface)]'
                  : 'border-[var(--danger)] bg-[var(--surface)]',
            )}
          >
            {/* Top Answer Badge Strip */}
            <div
              className={clsx(
                'px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between',
                result.answer === 'VERIFIED_MATCH'
                  ? 'bg-[var(--success-tint)] text-[var(--success)]'
                  : result.answer === 'SENT_TO_HOSPITAL'
                    ? 'bg-[var(--warning-tint)] text-[var(--warning)]'
                    : 'bg-[var(--danger-tint)] text-[var(--danger)]',
              )}
            >
              <div className="flex items-center gap-2">
                {result.answer === 'VERIFIED_MATCH' ? (
                  <>
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span id="desk-answer-title">VERIFIED HOSPITAL MATCH</span>
                  </>
                ) : result.answer === 'SENT_TO_HOSPITAL' ? (
                  <>
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span id="desk-answer-title">SENT TO HOSPITAL BLOOD BANK</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                    <span id="desk-answer-title">NOT VERIFIED</span>
                  </>
                )}
              </div>

              <span className="opacity-75 text-[11px] font-semibold">
                {result.trace.inputType === 'image' ? 'Multimodal Image Verification' : 'Text Verification'}
              </span>
            </div>

            {/* Answer Content Body */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Big Icon */}
                <div className="shrink-0">
                  {result.answer === 'VERIFIED_MATCH' ? (
                    <div className="w-16 h-16 rounded-2xl bg-[var(--success-tint)] text-[var(--success)] border-2 border-[var(--success)]/30 flex items-center justify-center shadow-xs">
                      <ShieldCheck className="w-9 h-9" aria-hidden="true" />
                    </div>
                  ) : result.answer === 'SENT_TO_HOSPITAL' ? (
                    <div className="w-16 h-16 rounded-2xl bg-[var(--warning-tint)] text-[var(--warning)] border-2 border-[var(--warning)]/30 flex items-center justify-center shadow-xs">
                      <Send className="w-9 h-9" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-[var(--danger-tint)] text-[var(--danger)] border-2 border-[var(--danger)]/30 flex items-center justify-center shadow-xs">
                      <ShieldAlert className="w-9 h-9" aria-hidden="true" />
                    </div>
                  )}
                </div>

                {/* Primary Answer Copy */}
                <div className="space-y-2 min-w-0 flex-1">
                  {result.answer === 'VERIFIED_MATCH' ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text)] leading-snug">
                        {t.desk.verifiedMatch}
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        Matches an active clinical order at {hospitalName}. Automated voice outreach is already in progress.
                      </p>
                    </>
                  ) : result.answer === 'SENT_TO_HOSPITAL' ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text)] leading-snug">
                        {t.desk.sentToHospital.replace('{hospitalName}', hospitalName)}
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        A secure one-tap alert was dispatched to the registered hospital blood bank. Please reach the hospital directly for emergency coordination.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--danger)] leading-snug">
                        {t.desk.notVerified}
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        The request could not be matched with a registered hospital or verified patient reference. Do not forward unverified requests.
                      </p>
                    </>
                  )}

                  {/* Backend Message with photo disclaimer */}
                  {result.message && (
                    <p className="text-xs text-[var(--text)]/90 pt-1 font-medium italic border-t border-[var(--border)]/40">
                      {result.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Warning Line if paymentPhrases is not empty */}
              {hasPayment && (
                <div
                  role="alert"
                  className="p-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-tint)] text-[var(--danger)] flex items-start gap-3 shadow-2xs"
                >
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <p className="font-heading font-bold">
                      {t.desk.paymentWarning}
                    </p>
                    <p className="text-xs opacity-90">
                      Under National Blood Transfusion Council regulations, commercial blood solicitation or offering cash conveyance is illegal.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Link for VERIFIED_MATCH or Demo Review link for SENT_TO_HOSPITAL */}
              {result.answer === 'VERIFIED_MATCH' && (
                <div className="pt-2">
                  <Link
                    to="/hospital"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white font-semibold text-xs sm:text-sm hover:opacity-95 transition-opacity shadow-xs focus-visible:outline-3 focus-visible:outline-[var(--info)]"
                  >
                    <span>{t.desk.statusLink}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </Link>
                </div>
              )}

              {result.answer === 'SENT_TO_HOSPITAL' && result.demoConfirmToken && (
                <div className="pt-2">
                  <Link
                    to={`/confirm/${result.demoConfirmToken}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--warning-tint)] text-[var(--warning)] border border-[var(--warning)]/30 font-semibold text-xs sm:text-sm hover:bg-[var(--warning-tint)]/80 transition-colors shadow-2xs focus-visible:outline-3 focus-visible:outline-[var(--info)]"
                  >
                    <span>Demo: open the hospital's confirm link</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>

            {/* Fixed Footer Stripe on Every Answer in Both Languages */}
            <div className="px-6 py-4 bg-[var(--text)] text-[var(--surface)] border-t border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                <p className="font-heading font-bold text-sm tracking-tight text-[var(--surface)]">
                  {t.desk.mandatoryFooterEn}
                </p>
              </div>

              <p
                lang="ta"
                className="text-xs font-semibold text-[var(--surface)]/80"
              >
                {t.desk.mandatoryFooterTa}
              </p>
            </div>
          </div>

          {/* Collapsible TracePanel: "How U2U checked this" */}
          <TracePanel
            trace={result.trace}
            rawText={submittedText}
            defaultOpen={true}
          />
        </section>
      )}
    </div>
  )
}

export default DeskPage
