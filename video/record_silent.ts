import { chromium, type Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'

const BASE_URL = 'https://uyir2uyir-53929.web.app'
const OUTPUT_DIR = 'C:\\Users\\Prakash\\Videos\\U2U_demo'
const AUDIO_FILE = path.join(OUTPUT_DIR, 'tamil_reply.wav')
const METADATA_FILE = path.join(OUTPUT_DIR, 'scenes_meta.json')

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Global tracking for fallbacks
let s6FallbackUsed: string | null = null

// Cursor and click highlight script to inject into page
const CURSOR_INJECTION_SCRIPT = `
(() => {
  if (window.__custom_cursor_installed__) return;
  window.__custom_cursor_installed__ = true;

  const cursor = document.createElement('div');
  cursor.id = 'playwright-cursor';
  cursor.style.position = 'fixed';
  cursor.style.top = '0';
  cursor.style.left = '0';
  cursor.style.width = '24px';
  cursor.style.height = '24px';
  cursor.style.borderRadius = '50%';
  cursor.style.border = '2px solid #ffffff';
  cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.85)';
  cursor.style.boxShadow = '0 0 10px rgba(0,0,0,0.45)';
  cursor.style.pointerEvents = 'none';
  cursor.style.zIndex = '999999';
  cursor.style.transform = 'translate(-50%, -50%)';
  cursor.style.transition = 'transform 0.08s ease-out, background-color 0.15s ease';
  cursor.style.display = 'none';
  document.documentElement.appendChild(cursor);

  window.addEventListener('mousemove', (e) => {
    cursor.style.display = 'block';
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  }, true);

  window.addEventListener('mousedown', (e) => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
    const ripple = document.createElement('div');
    ripple.style.position = 'fixed';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    ripple.style.width = '52px';
    ripple.style.height = '52px';
    ripple.style.borderRadius = '50%';
    ripple.style.border = '3px solid #ef4444';
    ripple.style.pointerEvents = 'none';
    ripple.style.zIndex = '999998';
    ripple.style.transform = 'translate(-50%, -50%) scale(0.2)';
    ripple.style.opacity = '1';
    ripple.style.transition = 'transform 0.45s ease-out, opacity 0.45s ease-out';
    document.documentElement.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%, -50%) scale(1.6)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 450);
  }, true);

  window.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  }, true);
})();
`

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function assertNoMock(page: Page, sceneName: string): Promise<void> {
  const visibleText = await page.innerText('body')
  if (visibleText.includes('OFFLINE MOCK BUILD')) {
    throw new Error(`[CRITICAL] Scene ${sceneName}: Page shows 'OFFLINE MOCK BUILD'! Live backend required.`)
  }
  if (visibleText.includes('Mock extractor')) {
    throw new Error(`[CRITICAL] Scene ${sceneName}: Page shows 'Mock extractor'! Live backend required.`)
  }
}

async function smoothMove(page: Page, targetX: number, targetY: number, steps = 18): Promise<void> {
  await page.mouse.move(targetX, targetY, { steps })
}

async function smoothClick(page: Page, selector: string, timeout = 10000): Promise<void> {
  const locator = page.locator(selector).first()
  await locator.waitFor({ state: 'visible', timeout })
  await locator.scrollIntoViewIfNeeded()
  await sleep(200)

  const box = await locator.boundingBox()
  if (!box) {
    await locator.click()
    await sleep(1500)
    return
  }

  const targetX = box.x + box.width / 2
  const targetY = box.y + box.height / 2
  await smoothMove(page, targetX, targetY, 20)
  await sleep(200)
  await page.mouse.down()
  await sleep(120)
  await page.mouse.up()
  // 1.5 s pause after each click
  await sleep(1500)
}

async function slowType(page: Page, selector: string, text: string, delayMs = 300): Promise<void> {
  await smoothClick(page, selector)
  const locator = page.locator(selector).first()
  await locator.fill('')
  await locator.pressSequentially(text, { delay: delayMs })
  await sleep(400)
}

async function smoothScroll(page: Page, targetY: number, durationMs = 1500): Promise<void> {
  await page.evaluate(`
    new Promise((resolve) => {
      const startY = window.scrollY;
      const distance = ${targetY} - startY;
      const duration = ${durationMs};
      const startTime = performance.now();

      function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        window.scrollTo(0, startY + distance * ease);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(step);
    })
  `)
  await sleep(400)
}

async function ensureDemoAuth(page: Page): Promise<void> {
  // If already on /hospital or authenticated, return quickly
  if (page.url().includes('/hospital') || page.url().includes('/centre')) {
    return
  }
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  await sleep(600)
  const signOutBtn = page.locator('button[aria-label="Sign out demo role"]').first()
  if (await signOutBtn.isVisible()) {
    return
  }
  console.log('[*] Signing in as demo hospital role...')
  await smoothScroll(page, 850, 1200)
  const hospBtn = page.locator('button:has-text("Hospital demo")').first()
  if (await hospBtn.isVisible()) {
    await smoothClick(page, 'button:has-text("Hospital demo")')
    await page.waitForURL('**/hospital', { timeout: 15000 })
    await sleep(800)
  }
}

async function padScene(startTimeMs: number, targetSeconds: number, sceneName: string): Promise<number> {
  const elapsedSeconds = (Date.now() - startTimeMs) / 1000
  if (elapsedSeconds < targetSeconds) {
    const padMs = Math.ceil((targetSeconds - elapsedSeconds) * 1000)
    console.log(`[*] Scene ${sceneName}: took ${elapsedSeconds.toFixed(1)}s, holding still frame for ${(padMs / 1000).toFixed(1)}s to reach target ${targetSeconds}s`)
    await sleep(padMs)
  }
  const totalSeconds = (Date.now() - startTimeMs) / 1000
  console.log(`[OK] Scene ${sceneName}: completed in ${totalSeconds.toFixed(1)}s (target: ${targetSeconds}s)`)
  return totalSeconds
}

interface SceneConfig {
  id: string
  name: string
  targetSeconds: number
  filename: string
  recordFn: (page: Page) => Promise<void>
  audioCapture?: boolean
}

const SCENES: SceneConfig[] = [
  {
    id: 'S1',
    name: 'Landing',
    targetSeconds: 15,
    filename: 'S1_landing.webm',
    recordFn: async (page: Page) => {
      console.log('--- S1 Landing (15s) ---')
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S1')
      await sleep(1500)

      // Slow scroll through the hero and "Our Three Promises"
      console.log('[*] Scrolling through hero and Our Three Promises...')
      await smoothScroll(page, 750, 4500)
      await sleep(2000)
      await smoothScroll(page, 1100, 3000)
      await sleep(1500)
    },
  },
  {
    id: 'S2',
    name: 'Desk text',
    targetSeconds: 25,
    filename: 'S2_desk_text.webm',
    recordFn: async (page: Page) => {
      console.log('--- S2 Desk text (25s) ---')
      // Rule: Before S2, click "Reset demo"
      console.log('[*] Resetting demo data before S2...')
      await page.goto(`${BASE_URL}/desk`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S2')
      await sleep(1000)

      const resetBtn = page.locator('button:has-text("Reset demo")').first()
      if (await resetBtn.isVisible()) {
        await smoothClick(page, 'button:has-text("Reset demo")')
        await sleep(2500)
      }

      // Click "Verified Match (English)"
      console.log('[*] Clicking "Verified Match (English)" sample...')
      await smoothClick(page, 'button:has-text("Verified Match (English)")')

      // Click "Check message"
      console.log('[*] Clicking "Check message"...')
      await smoothClick(page, 'button:has-text("Check message")')

      // Wait for answer
      console.log('[*] Waiting for VERIFIED HOSPITAL MATCH answer...')
      await page.waitForSelector('text=VERIFIED HOSPITAL MATCH', { timeout: 20000 })
      await assertNoMock(page, 'S2')
      await sleep(1500)

      // Ensure "How U2U checked this" is expanded
      const traceHeader = page.locator('button:has-text("How U2U checked this")').first()
      if (await traceHeader.isVisible()) {
        const isExpanded = await traceHeader.getAttribute('aria-expanded')
        if (isExpanded === 'false') {
          console.log('[*] Expanding "How U2U checked this"...')
          await smoothClick(page, 'button:has-text("How U2U checked this")')
        }
      }

      // Scroll slowly through the quote table
      console.log('[*] Scrolling through extracted quotes table...')
      await smoothScroll(page, 950, 4000)
      await sleep(2000)
    },
  },
  {
    id: 'S3',
    name: 'Desk photo',
    targetSeconds: 20,
    filename: 'S3_desk_photo.webm',
    recordFn: async (page: Page) => {
      console.log('--- S3 Desk photo (20s) ---')
      await page.goto(`${BASE_URL}/desk`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S3')
      await sleep(1000)

      // Click "Upload photo" tab
      console.log('[*] Switching to "Upload photo" tab...')
      await smoothClick(page, '#tab-upload-photo')

      // Click "Photo: unknown hospital" sample
      console.log('[*] Selecting sample "Photo: unknown hospital"...')
      await smoothClick(page, 'button:has-text("Photo: unknown hospital")')

      // If Check photo button is visible and enabled, click it
      const checkPhotoBtn = page.locator('button:has-text("Check photo")').first()
      if (await checkPhotoBtn.isVisible() && await checkPhotoBtn.isEnabled()) {
        console.log('[*] Clicking "Check photo"...')
        await smoothClick(page, 'button:has-text("Check photo")')
      }

      // Wait for NOT_VERIFIED
      console.log('[*] Waiting for NOT VERIFIED result...')
      await page.waitForSelector('text=NOT VERIFIED', { timeout: 25000 })
      await assertNoMock(page, 'S3')
      await sleep(1500)

      // Show "Text Gemini read from the photo" and "A photo can be edited" line
      console.log('[*] Scrolling to show Gemini photo transcript and disclaimer...')
      await smoothScroll(page, 700, 3000)
      await sleep(2500)
    },
  },
  {
    id: 'S4',
    name: 'Scam',
    targetSeconds: 12,
    filename: 'S4_scam.webm',
    recordFn: async (page: Page) => {
      console.log('--- S4 Scam (12s) ---')
      await page.goto(`${BASE_URL}/desk`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S4')
      await sleep(1000)

      // Click "Paste text" tab
      console.log('[*] Switching to "Paste text" tab...')
      await smoothClick(page, '#tab-paste-text')

      // Click "Unverified / Scam Remuneration (English)"
      console.log('[*] Selecting "Unverified / Scam Remuneration (English)"...')
      await smoothClick(page, 'button:has-text("Unverified / Scam Remuneration (English)")')

      // Click "Check message"
      console.log('[*] Clicking "Check message"...')
      await smoothClick(page, 'button:has-text("Check message")')

      // Wait for NOT_VERIFIED answer
      console.log('[*] Waiting for NOT VERIFIED answer & mandatory footer...')
      await page.waitForSelector('text=NOT VERIFIED', { timeout: 20000 })
      await page.waitForSelector('text=Nobody may charge you for a donor.', { timeout: 10000 })
      await assertNoMock(page, 'S4')
      await sleep(800)

      // Scroll to highlight warning and mandatory footer
      await smoothScroll(page, 550, 1500)
    },
  },
  {
    id: 'S5',
    name: 'Hospital to Blood centre',
    targetSeconds: 25,
    filename: 'S5_hospital_to_centre.webm',
    recordFn: async (page: Page) => {
      console.log('--- S5 Hospital to Blood centre (25s) ---')
      await ensureDemoAuth(page)
      await page.waitForURL('**/hospital', { timeout: 15000 })
      await assertNoMock(page, 'S5')
      await sleep(800)

      // Enter Patient Reference: IP-202
      console.log('[*] Typing Patient Reference IP-202...')
      await slowType(page, '#patientRef', 'IP-202', 300)

      // Click submit button (Raise request)
      console.log('[*] Submitting urgent request...')
      await smoothClick(page, 'button[type="submit"]')
      await sleep(2000)

      // Navigate to /centre
      console.log('[*] Navigating to /centre dashboard...')
      await page.goto(`${BASE_URL}/centre`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S5')
      await sleep(1000)

      // Show live timeline and donors on the way sorted by ETA
      console.log('[*] Showing live timeline and donors on the way...')
      await smoothScroll(page, 450, 2500)
      await sleep(1500)
    },
  },
  {
    id: 'S6',
    name: 'Voice call',
    targetSeconds: 25,
    filename: 'S6_voice_call.webm',
    audioCapture: true,
    recordFn: async (page: Page) => {
      console.log('--- S6 Voice call (25s) ---')
      await ensureDemoAuth(page)

      await page.goto(`${BASE_URL}/sim?live=1`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S6')
      await sleep(2500)

      // Scroll to phone view
      await smoothScroll(page, 200, 1000)

      // Select ringing call from the list if present
      const callCard = page.locator('button[aria-label*="Select ringing call"]').first()
      if (await callCard.isVisible()) {
        console.log('[*] Selecting ringing call from the list...')
        await smoothClick(page, 'button[aria-label*="Select ringing call"]')
        await sleep(1000)
      }

      // Ensure Answer with your voice button is ready
      console.log('[*] Waiting for "Answer with your voice (Gemini Live)" button...')
      await page.waitForSelector('button:has-text("Answer with your voice (Gemini Live)")', { timeout: 20000 })

      // Click "Answer with your voice (Gemini Live)"
      console.log('[*] Clicking "Answer with your voice (Gemini Live)"...')
      await smoothClick(page, 'button:has-text("Answer with your voice (Gemini Live)")')

      console.log('[*] Virtual mic streaming tamil_reply.wav. Waiting up to 20s for Gemini Live reply...')
      let answered = false
      const startTime = Date.now()

      while (Date.now() - startTime < 20000) {
        const textContent = await page.content()
        if (
          textContent.includes("I'm coming") ||
          textContent.includes('COMING') ||
          textContent.includes('about 20 min') ||
          textContent.includes('varen')
        ) {
          answered = true
          console.log('[OK] Gemini Live voice reply recognized!')
          break
        }
        await sleep(1000)
      }

      if (!answered) {
        console.log('[*] Gemini Live did not respond within 20s. Using keypad fallback: pressing "1"...')
        s6FallbackUsed = 'S6 used keypad fallback'
        // Click keypad 1 button
        const key1 = page.locator('button[aria-label*="Digit 1"]').first()
        if (await key1.isVisible()) {
          await smoothClick(page, 'button[aria-label*="Digit 1"]')
        } else {
          await smoothClick(page, '#sim-keypad-section button:has-text("1")')
        }
      }

      await sleep(2000)
      await assertNoMock(page, 'S6')
    },
  },
  {
    id: 'S7',
    name: 'Run the story',
    targetSeconds: 25,
    filename: 'S7_run_story.webm',
    recordFn: async (page: Page) => {
      console.log('--- S7 Run the story (25s) ---')
      await ensureDemoAuth(page)
      await page.goto(`${BASE_URL}/centre`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S7')
      await sleep(1000)

      // Click "Run the story"
      console.log('[*] Clicking "Run the story"...')
      await smoothClick(page, 'button:has-text("Run the story")')

      // Stay on the screen that shows the counting rule until FULFILLED
      console.log('[*] Watching counting rule progress until FULFILLED...')
      const startPoll = Date.now()
      let fulfilled = false

      // Poll up to 10s so scene stays right at 25s target
      while (Date.now() - startPoll < 10000) {
        const content = await page.content()
        if (content.includes('FULFILLED') || content.includes('Fulfilled') || content.includes('Request Fulfilled')) {
          fulfilled = true
          console.log('[OK] Request reached FULFILLED state!')
          break
        }
        await sleep(1000)
      }

      if (!fulfilled) {
        console.log('[*] Story continuing dispatch...')
      }

      // Smooth pan over the progress and timeline
      await smoothScroll(page, 350, 1500)
      await sleep(1000)
    },
  },
  {
    id: 'S8',
    name: 'Close',
    targetSeconds: 18,
    filename: 'S8_close.webm',
    recordFn: async (page: Page) => {
      console.log('--- S8 Close (18s) ---')
      await page.goto(`${BASE_URL}/impact`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S8')
      await sleep(1500)

      // Scroll to the simulated honesty line
      console.log('[*] Scrolling to honesty disclaimer line...')
      await smoothScroll(page, 180, 2000)
      await sleep(3500)

      // Return to landing hero
      console.log('[*] Returning to Landing Page hero...')
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
      await assertNoMock(page, 'S8')
      await sleep(2000)
    },
  },
]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function recordScene(scene: SceneConfig): Promise<{ duration: number; videoFile: string }> {
  console.log(`\n======================================================`)
  console.log(`RECORDING: ${scene.id} — ${scene.name} (Target: ${scene.targetSeconds}s)`)
  console.log(`======================================================`)

  const browserArgs = [
    '--window-size=1920,1080',
    '--window-position=0,0',
    '--disable-infobars',
    '--autoplay-policy=no-user-gesture-required',
  ]

  if (scene.audioCapture) {
    browserArgs.push(
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${AUDIO_FILE}`,
    )
  }

  const browser = await chromium.launch({
    headless: false,
    args: browserArgs,
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
    permissions: ['microphone'],
  })

  await context.addInitScript(CURSOR_INJECTION_SCRIPT)

  const page = await context.newPage()

  const startTime = Date.now()
  let duration = 0

  try {
    await scene.recordFn(page)
    duration = await padScene(startTime, scene.targetSeconds, scene.name)
  } catch (err) {
    console.error(`[ERROR] Scene ${scene.id} failed:`, err)
    await context.close()
    await browser.close()
    throw err
  }

  // Close context to flush video
  await page.close()
  await context.close()
  await browser.close()

  const video = page.video()
  if (!video) {
    throw new Error(`[ERROR] No video was recorded for ${scene.id}`)
  }

  const rawVideoPath = await video.path()
  const targetPath = path.join(OUTPUT_DIR, scene.filename)

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
  }
  fs.renameSync(rawVideoPath, targetPath)
  console.log(`[OK] Saved scene video: ${targetPath}`)

  return { duration, videoFile: targetPath }
}

async function main() {
  const args = process.argv.slice(2)
  let targetSceneId: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scene' && args[i + 1]) {
      targetSceneId = args[i + 1].toUpperCase()
      break
    } else if (args[i].startsWith('--scene=')) {
      targetSceneId = args[i].split('=')[1].toUpperCase()
      break
    }
  }

  // Clean up any stray temporary Playwright video files
  const existingFiles = fs.readdirSync(OUTPUT_DIR)
  for (const f of existingFiles) {
    if (f.startsWith('page@') && f.endsWith('.webm')) {
      try {
        fs.unlinkSync(path.join(OUTPUT_DIR, f))
      } catch {
        // ignore
      }
    }
  }

  // Load existing metadata if available
  let allMeta: Record<string, { duration: number; videoFile: string }> = {}
  if (fs.existsSync(METADATA_FILE)) {
    try {
      allMeta = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
    } catch {
      allMeta = {}
    }
  }

  const scenesToRun = targetSceneId
    ? SCENES.filter((s) => s.id === targetSceneId)
    : SCENES

  if (scenesToRun.length === 0) {
    console.error(`Unknown scene: ${targetSceneId}. Available scenes: ${SCENES.map((s) => s.id).join(', ')}`)
    process.exit(1)
  }

  console.log(`\n======================================================`)
  console.log(`U2U Silent Video Recorder (1920x1080 Headed Chromium)`)
  console.log(`Target: ${BASE_URL}`)
  console.log(`Output Directory: ${OUTPUT_DIR}`)
  console.log(`Scenes to record: ${scenesToRun.map((s) => s.id).join(', ')}`)
  console.log(`======================================================\n`)

  for (const scene of scenesToRun) {
    const res = await recordScene(scene)
    allMeta[scene.id] = { duration: res.duration, videoFile: res.videoFile }
    fs.writeFileSync(METADATA_FILE, JSON.stringify(allMeta, null, 2), 'utf8')
    // Brief breather between scenes
    await sleep(2000)
  }

  // Calculate timing table across all 8 scenes
  let currentSecond = 0
  const timingLines: string[] = [
    'U2U Demo Scenes Timing',
    '======================',
  ]

  for (const scene of SCENES) {
    const meta = allMeta[scene.id]
    const dur = meta ? meta.duration : scene.targetSeconds
    const startStr = formatTime(currentSecond)
    const endStr = formatTime(currentSecond + dur)
    const durStr = formatTime(dur)
    timingLines.push(
      `${scene.id} ${scene.name.padEnd(26, ' ')} ${startStr} to ${endStr} (Duration: ${durStr})`,
    )
    currentSecond += dur
  }

  const totalLengthStr = formatTime(currentSecond)
  timingLines.push('')
  timingLines.push(`Total Length: ${totalLengthStr} (must be under 3:00)`)
  timingLines.push(`Fallback: ${s6FallbackUsed || 'None'}`)

  const timingContent = timingLines.join('\n')
  const timingFile = path.join(OUTPUT_DIR, 'timing.txt')
  fs.writeFileSync(timingFile, timingContent, 'utf8')
  console.log(`\n[OK] Wrote timing file: ${timingFile}`)
  console.log(timingContent)

  // Check ffmpeg for joining
  console.log(`\n--- Video Concatenation ---`)
  let hasFfmpeg = false
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    hasFfmpeg = true
  } catch {
    hasFfmpeg = false
  }

  if (hasFfmpeg && !targetSceneId) {
    console.log('[*] FFmpeg detected. Joining scenes into U2U_demo_silent.mp4...')
    const concatListFile = path.join(OUTPUT_DIR, 'concat_list.txt')
    const listContent = SCENES.map((s) => `file '${path.join(OUTPUT_DIR, s.filename).replace(/\\/g, '/')}'`).join('\n')
    fs.writeFileSync(concatListFile, listContent, 'utf8')

    const joinedOutput = path.join(OUTPUT_DIR, 'U2U_demo_silent.mp4')
    const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListFile}" -c:v libx264 -pix_fmt yuv420p -r 30 -an "${joinedOutput}"`
    try {
      execSync(ffmpegCmd, { stdio: 'inherit' })
      console.log(`[OK] Created joined video: ${joinedOutput}`)
    } catch (ffErr) {
      console.error('[!] Failed to join videos with ffmpeg:', ffErr)
    }
  } else if (!hasFfmpeg) {
    console.log('[Notice] ffmpeg is not installed or not in PATH.')
    console.log('To install ffmpeg on Windows, run:')
    console.log('   winget install Gyan.FFmpeg')
    console.log('Then join the scenes into a silent MP4 with:')
    console.log(`   ffmpeg -y -f concat -safe 0 -i "${path.join(OUTPUT_DIR, 'concat_list.txt')}" -c:v libx264 -pix_fmt yuv420p -r 30 -an "${path.join(OUTPUT_DIR, 'U2U_demo_silent.mp4')}"`)
  }

  console.log(`\n[ALL DONE] All demo scenes recorded successfully!`)
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err)
  process.exit(1)
})
