import type { DeskResult, BloodGroup, Component } from '../types'
import { MOCK_HOSPITALS } from './fixtures'

export interface SampleMessage {
  id: string
  title: string
  expectedAnswer: DeskResult['answer']
  lang: 'en' | 'ta' | 'tanglish'
  text: string
}

export const SAMPLE_MESSAGES: SampleMessage[] = [
  // 1. VERIFIED_MATCH samples
  {
    id: 'sample-vm-en',
    title: 'Verified Match (English)',
    expectedAnswer: 'VERIFIED_MATCH',
    lang: 'en',
    text: 'URGENT: Patient IP-101 at Sample General Hospital, Chennai needs 2 units of O+ RED_CELLS immediately for emergency cardiac surgery. Please contact hospital blood bank.',
  },
  {
    id: 'sample-vm-tanglish',
    title: 'Verified Match (Tanglish)',
    expectedAnswer: 'VERIFIED_MATCH',
    lang: 'tanglish',
    text: 'Emergency alert! Patient IP-101 ku O+ blood 2 units thevai at Sample General Hospital, Chennai. Emergency operation. Please reach blood bank immediately.',
  },

  // 2. SENT_TO_HOSPITAL samples
  {
    id: 'sample-sth-en',
    title: 'Sent to Hospital Blood Bank (English)',
    expectedAnswer: 'SENT_TO_HOSPITAL',
    lang: 'en',
    text: 'Need urgent blood at Metropolitan Care Hospital, Chennai for emergency care. Looking for eligible volunteer donors nearby.',
  },
  {
    id: 'sample-sth-ta',
    title: 'Sent to Hospital Blood Bank (Tamil)',
    expectedAnswer: 'SENT_TO_HOSPITAL',
    lang: 'ta',
    text: 'அவசர இரத்தத் தேவை: Metropolitan Care Hospital, Chennai-ல் அனுமதிக்கப்பட்டுள்ள நோயாளிக்கு அவசரமாக இரத்தம் தேவைப்படுகிறது. இரத்த வங்கிக்கு உதவவும்.',
  },

  // 3. NOT_VERIFIED samples
  {
    id: 'sample-nv-payment',
    title: 'Unverified / Scam Remuneration (English)',
    expectedAnswer: 'NOT_VERIFIED',
    lang: 'en',
    text: 'Urgent blood donor needed. Donor will be paid 3000 rupees conveyance charge in cash. Contact immediately.',
  },
  {
    id: 'sample-nv-generic',
    title: 'Unverified / Unknown Hospital (Tamil)',
    expectedAnswer: 'NOT_VERIFIED',
    lang: 'ta',
    text: 'பகிரப்பட்ட செய்தி: சென்னையில் உள்ள ஒரு தனியார் மருத்துவமனையில் அவசரமாக இரத்தம் தேவைப்படுகிறது. அனைத்து குழுக்களிலும் பகிரவும்.',
  },
]

export interface DeskCheckContext {
  openRequests: { id: string; hospitalName: string; patientRef?: string }[]
  generateConfirmToken?: (hospitalName: string) => string
}

/**
 * Rules-based fake extraction imitating Gemini Flash + deterministic Python code verification.
 */
export async function mockCheckDesk(
  text: string,
  context: DeskCheckContext,
): Promise<DeskResult> {
  // 1. Realistic 600ms latency simulation
  await new Promise((resolve) => setTimeout(resolve, 600))

  const lowerText = text.toLowerCase()

  // 2. Check for payment/remuneration words
  const paymentWords = ['pay', 'charge', 'rupees', 'rupee', '₹', 'compensation', 'cash', 'money']
  const detectedPaymentPhrases: string[] = []

  for (const word of paymentWords) {
    if (lowerText.includes(word.toLowerCase())) {
      const idx = lowerText.indexOf(word.toLowerCase())
      const snippet = text.slice(Math.max(0, idx - 10), Math.min(text.length, idx + word.length + 15)).trim()
      detectedPaymentPhrases.push(snippet || word)
    }
  }

  // 3. Detect hospital from fixtures
  const matchedHospital = MOCK_HOSPITALS.find((h) => lowerText.includes(h.name.toLowerCase()))

  // 4. Extract patient number quote if present (e.g. IP-101, IP-84920, etc.)
  const patientMatch = text.match(/\bIP-?\d+\b/i)
  const patientNumber = patientMatch ? patientMatch[0] : null

  // 5. Detect blood group
  const bloodGroups: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
  const matchedBloodGroup = bloodGroups.find((bg) => text.includes(bg)) ?? null

  // 6. Detect component
  let matchedComponent: Component | null = null
  if (/red[_\s]?cells|prbc/i.test(text)) matchedComponent = 'RED_CELLS'
  else if (/platelet|sdp/i.test(text)) matchedComponent = 'PLATELETS_SDP'
  else if (/plasma/i.test(text)) matchedComponent = 'PLASMA'
  else if (/whole[_\s]?blood/i.test(text)) matchedComponent = 'WHOLE_BLOOD'

  // Extract units
  const unitsMatch = text.match(/(\d+)\s*(?:units?|packs?)/i)
  const unitsValue = unitsMatch ? parseInt(unitsMatch[1], 10) : null

  // 7. Payment phrases force NOT_VERIFIED
  if (detectedPaymentPhrases.length > 0) {
    return {
      answer: 'NOT_VERIFIED',
      message: "Couldn't verify. Requests offering or soliciting payment are prohibited.",
      footer: 'Nobody may charge you for a donor.',
      trace: {
        hospital: {
          value: matchedHospital ? matchedHospital.name : null,
          quote: matchedHospital ? matchedHospital.name : null,
          kept: false,
        },
        patientNumber: {
          value: patientNumber,
          quote: patientNumber,
          kept: false,
        },
        bloodGroup: {
          value: matchedBloodGroup,
          quote: matchedBloodGroup,
          kept: false,
        },
        component: {
          value: matchedComponent,
          quote: matchedComponent,
          kept: false,
        },
        units: {
          value: unitsValue,
          quote: unitsMatch ? unitsMatch[0] : null,
          kept: false,
        },
        paymentPhrases: detectedPaymentPhrases,
        geminiChoice: 'Mock extractor (not Gemini): Flagged remuneration words.',
        codeDecision: 'NOT_VERIFIED: Commercial blood requests are illegal under NBTC guidelines.',
      },
    }
  }

  // 8. If hospital found and patient number matches an open request -> VERIFIED_MATCH
  if (matchedHospital) {
    const matchingReq = context.openRequests.find(
      (r) =>
        r.hospitalName.toLowerCase() === matchedHospital.name.toLowerCase() &&
        patientNumber &&
        r.patientRef &&
        r.patientRef.toLowerCase() === patientNumber.toLowerCase(),
    )

    if (matchingReq) {
      return {
        answer: 'VERIFIED_MATCH',
        message: 'Verified hospital request. Match confirmed with active hospital order.',
        requestId: matchingReq.id,
        hospitalName: matchedHospital.name,
        footer: 'Nobody may charge you for a donor.',
        trace: {
          hospital: { value: matchedHospital.name, quote: matchedHospital.name, kept: true },
          patientNumber: { value: patientNumber, quote: patientNumber, kept: true },
          bloodGroup: { value: matchedBloodGroup, quote: matchedBloodGroup, kept: Boolean(matchedBloodGroup) },
          component: { value: matchedComponent, quote: matchedComponent, kept: Boolean(matchedComponent) },
          units: { value: unitsValue, quote: unitsMatch ? unitsMatch[0] : null, kept: Boolean(unitsValue) },
          paymentPhrases: [],
          geminiChoice: `Mock extractor (not Gemini): Extracted verified hospital "${matchedHospital.name}" and patient "${patientNumber}".`,
          codeDecision: 'VERIFIED_MATCH: Exact patient reference match found in open hospital orders.',
        },
      }
    }

    // 9. Hospital found but no active patient match -> SENT_TO_HOSPITAL
    const demoToken = context.generateConfirmToken
      ? context.generateConfirmToken(matchedHospital.name)
      : `token-${Date.now()}`

    return {
      answer: 'SENT_TO_HOSPITAL',
      message: 'Sent to hospital blood bank. Pending hospital verification.',
      hospitalName: matchedHospital.name,
      demoConfirmToken: demoToken,
      footer: 'Nobody may charge you for a donor.',
      trace: {
        hospital: { value: matchedHospital.name, quote: matchedHospital.name, kept: true },
        patientNumber: { value: patientNumber, quote: patientNumber, kept: Boolean(patientNumber) },
        bloodGroup: { value: matchedBloodGroup, quote: matchedBloodGroup, kept: Boolean(matchedBloodGroup) },
        component: { value: matchedComponent, quote: matchedComponent, kept: Boolean(matchedComponent) },
        units: { value: unitsValue, quote: unitsMatch ? unitsMatch[0] : null, kept: Boolean(unitsValue) },
        paymentPhrases: [],
        geminiChoice: `Mock extractor (not Gemini): Found hospital "${matchedHospital.name}". No active patient reference match.`,
        codeDecision: 'SENT_TO_HOSPITAL: Hospital recognized. One-tap alert generated for blood bank confirmation.',
      },
    }
  }

  // 10. Default: NOT_VERIFIED
  return {
    answer: 'NOT_VERIFIED',
    message: "Couldn't verify. Please call the hospital directly.",
    footer: 'Nobody may charge you for a donor.',
    trace: {
      hospital: { value: null, quote: null, kept: false },
      patientNumber: { value: patientNumber, quote: patientNumber, kept: false },
      bloodGroup: { value: matchedBloodGroup, quote: matchedBloodGroup, kept: false },
      component: { value: matchedComponent, quote: matchedComponent, kept: false },
      units: { value: unitsValue, quote: unitsMatch ? unitsMatch[0] : null, kept: false },
      paymentPhrases: [],
      geminiChoice: 'Mock extractor (not Gemini): No registered hospital name found in text.',
      codeDecision: 'NOT_VERIFIED: Forwarded message cannot be attributed to a registered hospital.',
    },
  }
}

export async function mockCheckDeskImage(
  file: Blob,
  caption = '',
  context: DeskCheckContext,
): Promise<DeskResult> {
  await new Promise((resolve) => setTimeout(resolve, 600))

  const fileName = (file as File).name || ''
  const size = file.size
  const isUnknownSample =
    fileName.includes('unknown') ||
    (size >= 100000 && size <= 106000) ||
    caption.toLowerCase().includes('demo care')

  const disclaimer =
    "A photo can be edited. We check it against the hospital's live requests, not how real it looks. (புகைப்படங்கள் திருத்தப்படலாம். மருத்துவமனையின் நேரடி கோரிக்கைகளுடன் ஒப்பிட்டே நாங்கள் சரிபார்க்கிறோம், அது எவ்வளவு உண்மையானதாகத் தோன்றுகிறது என்பதைப் பார்த்து அல்ல.)"

  if (isUnknownSample) {
    return {
      answer: 'NOT_VERIFIED',
      message: `Couldn't verify. Please call the hospital directly. ${disclaimer}`,
      footer: 'Nobody may charge you for a donor.',
      trace: {
        inputType: 'image',
        transcript:
          "🩸 Urgent Need: Any +ve group\nPatient name: Arun Kumar\nDemo Care Hospital Tambaram Selaiyur\nUrgent Any blood needed for operation tomorrow morning (23 Sept 2026)\nContact: +91 90000 00001\n(Patient's grandfather)\nPlease share with Frnds and fam\nSAMPLE · fictional data",
        hospital: {
          value: null,
          quote: 'Demo Care Hospital Tambaram Selaiyur',
          kept: false,
        },
        patientNumber: { value: null, quote: null, kept: false },
        bloodGroup: { value: null, quote: null, kept: false },
        component: { value: null, quote: null, kept: false },
        units: { value: null, quote: null, kept: false },
        paymentPhrases: [],
        geminiChoice:
          "Mock extractor (not Gemini): Read photo text. Hospital 'Demo Care Hospital Tambaram Selaiyur' is not registered. 'Any +ve' is not a single blood group.",
        codeDecision:
          'NOT_VERIFIED: Hospital not recognized. No single blood group specified.',
      },
    }
  }

  const registeredTranscript =
    "🩸 Urgent Need: O+ve, 2 units\nPatient name: Arun Kumar\nIP No: IP-101\nSample General Hospital, Chennai\nRed cells needed for operation tomorrow morning\nContact: +91 90000 00001\n(Patient's grandfather)\nPlease share with Frnds and fam\nSAMPLE · fictional data"

  const matchedHospital =
    MOCK_HOSPITALS.find((h) =>
      h.name.toLowerCase().includes('sample general hospital'),
    ) || MOCK_HOSPITALS[0]

  const matchingReq = context.openRequests.find(
    (r) =>
      r.hospitalName.toLowerCase() === matchedHospital.name.toLowerCase() &&
      r.patientRef &&
      r.patientRef.toLowerCase() === 'ip-101',
  )

  if (matchingReq) {
    return {
      answer: 'VERIFIED_MATCH',
      message: `Verified hospital request. Match confirmed with active hospital order. ${disclaimer}`,
      requestId: matchingReq.id,
      hospitalName: matchedHospital.name,
      footer: 'Nobody may charge you for a donor.',
      trace: {
        inputType: 'image',
        transcript: registeredTranscript,
        hospital: {
          value: matchedHospital.name,
          quote: 'Sample General Hospital, Chennai',
          kept: true,
        },
        patientNumber: { value: 'IP-101', quote: 'IP-101', kept: true },
        bloodGroup: { value: 'O+', quote: 'O+ve', kept: true },
        component: { value: 'RED_CELLS', quote: 'Red cells', kept: true },
        units: { value: 2, quote: '2 units', kept: true },
        paymentPhrases: [],
        geminiChoice: `Mock extractor (not Gemini): Read photo text. Extracted "${matchedHospital.name}", patient "IP-101", O+ve, 2 units, Red cells.`,
        codeDecision:
          'VERIFIED_MATCH: Exact patient reference IP-101 matches active order at Sample General Hospital, Chennai.',
      },
    }
  }

  const demoToken = context.generateConfirmToken
    ? context.generateConfirmToken(matchedHospital.name)
    : `token-${Date.now()}`

  return {
    answer: 'SENT_TO_HOSPITAL',
    message: `Sent to hospital blood bank. Pending hospital verification. ${disclaimer}`,
    hospitalName: matchedHospital.name,
    demoConfirmToken: demoToken,
    footer: 'Nobody may charge you for a donor.',
    trace: {
      inputType: 'image',
      transcript: registeredTranscript,
      hospital: {
        value: matchedHospital.name,
        quote: 'Sample General Hospital, Chennai',
        kept: true,
      },
      patientNumber: { value: 'IP-101', quote: 'IP-101', kept: true },
      bloodGroup: { value: 'O+', quote: 'O+ve', kept: true },
      component: { value: 'RED_CELLS', quote: 'Red cells', kept: true },
      units: { value: 2, quote: '2 units', kept: true },
      paymentPhrases: [],
      geminiChoice: `Mock extractor (not Gemini): Found hospital "${matchedHospital.name}". No active patient reference match.`,
      codeDecision:
        'SENT_TO_HOSPITAL: Hospital recognized. One-tap alert generated for blood bank confirmation.',
    },
  }
}
