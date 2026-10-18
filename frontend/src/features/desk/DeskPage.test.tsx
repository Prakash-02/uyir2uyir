import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { DeskPage } from './DeskPage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'
import { getApi } from '../../api/client'

function renderDeskPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LangProvider>
          <DeskPage />
        </LangProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('DeskPage (/desk)', () => {
  beforeEach(() => {
    window.innerWidth = 1200
    mockEngine.reset()
  })

  it('renders textarea, 2,000 character counter, privacy note, and sample chips', async () => {
    renderDeskPage()

    // 1. Label and textarea
    expect(screen.getByLabelText(/Paste the message you received/i)).toBeInTheDocument()
    expect(screen.getByText(/0 \/ 2,000/i)).toBeInTheDocument()

    // 6. Privacy note
    expect(
      screen.getByText(/We don't keep your message\. Only the extracted details are checked\./i),
    ).toBeInTheDocument()

    // 2. Try a sample chips
    expect(screen.getByText(/Try a sample/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verified Match \(English\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verified Match \(Tanglish\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sent to Hospital Blood Bank \(English\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sent to Hospital Blood Bank \(Tamil\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unverified \/ Scam Remuneration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unverified \/ Unknown Hospital/i })).toBeInTheDocument()

    // Primary button disabled initially
    const checkBtn = screen.getByRole('button', { name: /Check message/i })
    expect(checkBtn).toBeDisabled()
  })

  it('renders VERIFIED_MATCH answer, status link, and footer stripe for verified request', async () => {
    renderDeskPage()

    // Select Sample 1 (Verified Match English)
    const sampleBtn = screen.getByRole('button', { name: /Verified Match \(English\)/i })
    await act(async () => {
      fireEvent.click(sampleBtn)
    })

    const textarea = screen.getByLabelText(/Paste the message you received/i) as HTMLTextAreaElement
    expect(textarea.value).toContain('Patient IP-101 at Sample General Hospital')

    const checkBtn = screen.getByRole('button', { name: /Check message/i })
    expect(checkBtn).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(checkBtn)
    })

    // 3. Answer Card: VERIFIED_MATCH
    expect(
      await screen.findByText('This request is verified. Donors are already being called.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Status link
    const statusLink = screen.getByRole('link', { name: /Check live request status/i })
    expect(statusLink).toBeInTheDocument()
    expect(statusLink).toHaveAttribute('href', '/hospital')

    // 4. Fixed footer stripe on answer in both languages
    expect(screen.getByText('Nobody may charge you for a donor.')).toBeInTheDocument()
    expect(
      screen.getByText('இரத்த தானத்திற்கு யாரும் உங்களிடம் கட்டணம் வசூலிக்கக் கூடாது.'),
    ).toBeInTheDocument()

    // 5. TracePanel
    expect(screen.getByText('How U2U checked this')).toBeInTheDocument()
    expect(
      screen.getByText('Gemini reads. Code checks every word. Only the hospital and blood centre decide.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Gemini chose:/i)).toBeInTheDocument()
    expect(screen.getByText(/Code decided:/i)).toBeInTheDocument()
    // Mock tag present for mock extractor
    const mockTags = screen.getAllByText('Mock')
    expect(mockTags.length).toBeGreaterThanOrEqual(1)
  })

  it('renders SENT_TO_HOSPITAL answer, hospital name, and footer stripe for recognized hospital with no active order', async () => {
    renderDeskPage()

    // Select Sample 3 (Sent to hospital)
    const sampleBtn = screen.getByRole('button', { name: /Sent to Hospital Blood Bank \(English\)/i })
    await act(async () => {
      fireEvent.click(sampleBtn)
    })

    const checkBtn = screen.getByRole('button', { name: /Check message/i })
    await act(async () => {
      fireEvent.click(checkBtn)
    })

    // 3. Answer Card: SENT_TO_HOSPITAL
    expect(
      await screen.findByText(
        "We've asked Metropolitan Care Hospital, Chennai's blood bank to confirm. Please also call them.",
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()

    // Demo review link
    expect(screen.getByRole('link', { name: /Demo: open the hospital's confirm link/i })).toBeInTheDocument()

    // 4. Fixed footer stripe
    expect(screen.getByText('Nobody may charge you for a donor.')).toBeInTheDocument()
    expect(
      screen.getByText('இரத்த தானத்திற்கு யாரும் உங்களிடம் கட்டணம் வசூலிக்கக் கூடாது.'),
    ).toBeInTheDocument()
  })

  it('renders NOT_VERIFIED answer, payment warning line, and footer stripe when remuneration is detected', async () => {
    renderDeskPage()

    // Select Sample 5 (Payment Scam)
    const sampleBtn = screen.getByRole('button', { name: /Unverified \/ Scam Remuneration/i })
    await act(async () => {
      fireEvent.click(sampleBtn)
    })

    const checkBtn = screen.getByRole('button', { name: /Check message/i })
    await act(async () => {
      fireEvent.click(checkBtn)
    })

    // 3. Answer Card: NOT_VERIFIED
    expect(
      await screen.findByText("Couldn't verify. Please call the hospital directly.", {}, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Payment warning line
    expect(
      screen.getByText('This message mentions payment. Blood donation in India is voluntary and unpaid.'),
    ).toBeInTheDocument()

    // 4. Fixed footer stripe
    expect(screen.getByText('Nobody may charge you for a donor.')).toBeInTheDocument()
    expect(
      screen.getByText('இரத்த தானத்திற்கு யாரும் உங்களிடம் கட்டணம் வசூலிக்கக் கூடாது.'),
    ).toBeInTheDocument()

    // Trace panel indicates payment
    expect(screen.getByText(/Remuneration \/ Payment Language Detected/i)).toBeInTheDocument()
  })

  it('displays loading state and handles API error cleanly', async () => {
    const api = getApi()
    const origCheckDesk = api.checkDesk
    api.checkDesk = async () => {
      throw new Error('Network failure simulation')
    }

    try {
      renderDeskPage()

      const textarea = screen.getByLabelText(/Paste the message you received/i)
      fireEvent.change(textarea, { target: { value: 'Random test text' } })

      const checkBtn = screen.getByRole('button', { name: /Check message/i })
      await act(async () => {
        fireEvent.click(checkBtn)
      })

      // 7. Error state
      expect(
        await screen.findByText("Couldn't check right now. Please call the hospital."),
      ).toBeInTheDocument()
    } finally {
      api.checkDesk = origCheckDesk
    }
  })

  it('switches between Paste text and Upload photo tabs', async () => {
    renderDeskPage()

    const textTab = screen.getByRole('tab', { name: /Paste text/i })
    const photoTab = screen.getByRole('tab', { name: /Upload photo/i })

    expect(textTab).toHaveAttribute('aria-selected', 'true')
    expect(photoTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByLabelText(/Paste the message you received/i)).toBeInTheDocument()

    // Switch to photo tab
    await act(async () => {
      fireEvent.click(photoTab)
    })

    expect(photoTab).toHaveAttribute('aria-selected', 'true')
    expect(textTab).toHaveAttribute('aria-selected', 'false')
    expect(
      screen.getByText(/Drag & drop a photo, paste \(Ctrl\+V\), or choose a file/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/We don't keep your photo\. Only the details we read are checked\./i),
    ).toBeInTheDocument()
  })

  it('handles file selection, shows preview thumbnail, and removes photo', async () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const origCreateObjectURL = URL.createObjectURL
    const origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = () => 'blob:mock-url-preview'
    URL.revokeObjectURL = () => {}

    try {
      renderDeskPage()

      // Switch to photo tab
      const photoTab = screen.getByRole('tab', { name: /Upload photo/i })
      await act(async () => {
        fireEvent.click(photoTab)
      })

      const fileInput = screen.getByLabelText(/Upload blood request photo/i) as HTMLInputElement
      const dummyFile = new File(['mock content'], 'test_slip.jpg', { type: 'image/jpeg' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [dummyFile] } })
      })

      // Thumbnail preview and remove button appear
      expect(await screen.findByText(/Photo Ready \(EXIF stripped\)/i)).toBeInTheDocument()
      expect(screen.getByAltText(/Uploaded blood request preview/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Optional caption or forwarded note/i)).toBeInTheDocument()

      // Click remove photo
      const removeBtns = screen.getAllByRole('button', { name: /Remove photo/i })
      await act(async () => {
        fireEvent.click(removeBtns[0])
      })

      // Back to drop zone
      expect(
        screen.getByText(/Drag & drop a photo, paste \(Ctrl\+V\), or choose a file/i),
      ).toBeInTheDocument()
    } finally {
      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
    }
  })

  it('handles image paste from clipboard', async () => {
    const origCreateObjectURL = URL.createObjectURL
    const origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = () => 'blob:mock-pasted-url'
    URL.revokeObjectURL = () => {}

    try {
      renderDeskPage()

      const dummyFile = new File(['clipboard content'], 'pasted.png', { type: 'image/png' })
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as unknown as ClipboardEvent
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [
            {
              type: 'image/png',
              getAsFile: () => dummyFile,
            },
          ],
        },
      })

      await act(async () => {
        window.dispatchEvent(pasteEvent)
      })

      // Automatically switched to photo tab with preview
      expect(await screen.findByText(/Photo Ready \(EXIF stripped\)/i)).toBeInTheDocument()
    } finally {
      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
    }
  })

  it('displays error message when an invalid file or oversized image is provided', async () => {
    renderDeskPage()

    // Switch to photo tab
    const photoTab = screen.getByRole('tab', { name: /Upload photo/i })
    await act(async () => {
      fireEvent.click(photoTab)
    })

    const fileInput = screen.getByLabelText(/Upload blood request photo/i)
    // Create oversized file (>5 MB)
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', {
      type: 'image/jpeg',
    })

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [bigFile] } })
    })

    expect(
      screen.getByText(/Please upload a JPG, PNG or WebP photo under 5 MB\./i),
    ).toBeInTheDocument()
  })

  it('handles clicking sample photo chips and displays image verification result', async () => {
    const origCreateObjectURL = URL.createObjectURL
    const origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = () => 'blob:mock-sample-url'
    URL.revokeObjectURL = () => {}

    // Mock global and window fetch for sample images
    const origGlobalFetch = globalThis.fetch
    const origWindowFetch = typeof window !== 'undefined' ? window.fetch : undefined

    const mockFetch = async (input: RequestInfo | URL) => {
      const urlStr = String(input)
      if (urlStr.includes('sample_photo')) {
        const isUnknown = urlStr.includes('unknown')
        const filename = isUnknown
          ? 'sample_photo_unknown_hospital.jpg'
          : 'sample_photo_registered_hospital.jpg'
        const blob = new Blob(['fake-sample-bytes'], { type: 'image/jpeg' })
        try {
          Object.defineProperty(blob, 'name', { value: filename, writable: true })
        } catch {
          // ignore
        }
        return new Response(blob, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      }
      return origGlobalFetch ? origGlobalFetch(input) : new Response(null, { status: 404 })
    }

    globalThis.fetch = mockFetch as typeof fetch
    if (typeof window !== 'undefined') {
      window.fetch = mockFetch as typeof fetch
    }

    try {
      renderDeskPage()

      // Switch to photo tab
      const photoTab = screen.getByRole('tab', { name: /Upload photo/i })
      await act(async () => {
        fireEvent.click(photoTab)
      })

      const sampleUnknownBtn = screen.getByRole('button', { name: /Photo: unknown hospital/i })
      expect(sampleUnknownBtn).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(sampleUnknownBtn)
      })

      // Result appears
      expect(
        await screen.findByRole(
          'heading',
          {
            name: /Couldn't verify\. Please call the hospital directly\./i,
          },
          { timeout: 8000 },
        ),
      ).toBeInTheDocument()
      expect(screen.getByText(/Multimodal Image Verification/i)).toBeInTheDocument()
      expect(screen.getByText(/Text Gemini read from the photo/i)).toBeInTheDocument()
      expect(screen.getByText('Nobody may charge you for a donor.')).toBeInTheDocument()
    } finally {
      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
      globalThis.fetch = origGlobalFetch
      if (typeof window !== 'undefined' && origWindowFetch) {
        window.fetch = origWindowFetch
      }
    }
  })
})
