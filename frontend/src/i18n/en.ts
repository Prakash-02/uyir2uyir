export const en = {
  appName: 'Uyir2Uyir',
  appSubtitle: 'Life passes on. Freely. Safely. In time.',
  tagline: 'Life passes on. Freely. Safely. In time.',
  summary:
    'Relays urgent blood requests from verified hospitals to nearby consented donors via automated phone calls, with a public Request Desk to verify forwarded messages.',

  // Navigation
  nav: {
    hospital: 'Hospital',
    centre: 'Blood centre',
    desk: 'Request Desk',
    join: 'Join as donor',
    impact: 'Impact',
    sim: 'Call Simulator',
    eval: 'AI Eval',
    styleguide: 'Styleguide',
  },

  // Demo Banner
  demoBanner: {
    badge: 'SIMULATED DATA',
    text: 'SIMULATED DATA · Demo mode · No real donors or patients',
    runStory: 'Run the story',
    running: 'Running story...',
    resetDemo: 'Reset demo',
  },

  // Three Promises
  promises: {
    sectionTitle: 'Our Three Promises',
    freely: {
      title: 'Freely',
      tagline: 'Life is given, never sold',
      desc: 'Life is given, never sold. Every answer ends with "Nobody may charge you for a donor." Payment wording blocks the hospital path.',
    },
    safely: {
      title: 'Safely',
      tagline: 'Only real requests, only staff decide',
      desc: 'Only real requests, only staff decide. Verified hospital requests, centre approved rules, only staff accept, phone numbers hidden.',
    },
    inTime: {
      title: 'In time',
      tagline: 'No family searching alone at 2 a.m.',
      desc: 'No family searching alone at 2 a.m. Calls 5 donors at a time, pauses when covered, reopens if someone drops out.',
    },
  },

  // Role Cards
  roles: {
    sectionTitle: 'Choose a Role',
    hospital: {
      title: 'Hospital Staff',
      desc: 'Raise urgent blood requests and track donor arrival progress in real time.',
      action: 'Open Hospital View',
    },
    centre: {
      title: 'Blood Centre Staff',
      desc: 'Accept or defer arriving donors, manage dispatch rounds, and monitor weather alerts.',
      action: 'Open Blood Centre',
    },
    desk: {
      title: 'Public Request Desk',
      desc: 'Verify forwarded WhatsApp blood request messages instantly before forwarding.',
      action: 'Verify a Message',
    },
    join: {
      title: 'Join as Donor',
      desc: 'Register your voluntary consent to receive emergency automated calls when blood is needed nearby.',
      action: 'Register Consent',
    },
  },

  // How it works
  howItWorks: {
    sectionTitle: 'How It Works',
    step1: {
      number: '1',
      title: 'Hospital raises',
      desc: 'A verified hospital raises an emergency request for target units needed.',
    },
    step2: {
      number: '2',
      title: 'U2U calls 5 donors',
      desc: 'Automated voice calls reach 5 nearby consented donors at a time in Tamil or English.',
    },
    step3: {
      number: '3',
      title: 'Donors press 1',
      desc: 'Donors press 1 if coming, automatically pausing calls once covered (N+1).',
    },
    step4: {
      number: '4',
      title: 'Staff accept',
      desc: 'Blood centre staff clinically screen, accept, or defer donors upon arrival.',
    },
  },

  // Footers
  footer: {
    prototype: 'Prototype for the Google Cloud AI Builder Cup 2026 · All data simulated',
    github: 'GitHub Repository',
    mandatory: 'Nobody may charge you for a donor.',
  },

  // Controls & common
  controls: {
    themeLight: 'Switch to light theme',
    themeDark: 'Switch to dark theme',
    themeSystem: 'Switch to system theme',
    langToggle: 'Switch language to Tamil',
    langName: 'English',
  },
  // Hospital screen
  hospital: {
    roleNote: 'Signed in as: Sample General Hospital (demo)',
    title: 'Hospital Blood Request Desk',
    subtitle: 'Raise an urgent request for verified clinical patient needs.',
    formTitle: 'Raise Urgent Request',
    bloodGroupLabel: 'Blood group',
    bloodGroupPlaceholder: 'Select blood group',
    componentLabel: 'Component',
    componentPlaceholder: 'Select component',
    components: {
      RED_CELLS: 'Red cells (PRBC)',
      PLATELETS_SDP: 'Platelets, single donor (SDP)',
      PLATELETS_RDP: 'Platelets, pooled (RDP)',
      WHOLE_BLOOD: 'Whole blood',
      PLASMA: 'Fresh frozen plasma (FFP)',
      UNSPECIFIED: 'Unspecified',
    },
    unitsLabel: 'Units needed (1 to 6)',
    patientRefLabel: 'Patient reference',
    patientRefPlaceholder: 'e.g. IP-101',
    patientRefHint: 'Only your hospital and the blood centre see this',
    submitButton: 'Raise request',
    submitting: 'Raising request...',
    errors: {
      bloodGroupRequired: 'Please select a blood group',
      componentRequired: 'Please select a blood component',
      unitsInvalid: 'Units needed must be between 1 and 6',
      patientRefRequired: 'Patient reference is required',
    },
    activeTitle: 'Active Request Live Tracker',
    cancelButton: 'Cancel request',
    cancelDialogTitle: 'Cancel blood request?',
    cancelDialogDesc:
      'This will immediately stand down automated outreach and cancel all active donor calls for this patient.',
    cancelKeep: 'Keep request',
    cancelConfirm: 'Confirm cancellation',
    fulfilledTitle: 'Fulfilled by the blood centre.',
    fulfilledDesc: 'All requested units have been clinically accepted by the blood bank.',
    sendChainMessage: 'Send Uyir chain message',
    chainPrivacyHint:
      "WhatsApp opens with a prefilled message. U2U never collects or stores the family's phone number.",
    myRequestsTitle: 'My Requests',
    myRequestsEmpty: 'No requests raised yet by this hospital.',
    liveTimelineTitle: 'Live Dispatch Timeline',
  },
  // Blood centre screen
  centre: {
    roleNote: 'Signed in as staff',
    badge: 'Blood Centre',
    title: 'Sample Blood Centre (demo)',
    subtitle: 'Manage live outreach rounds, clinical triage, and inclement weather safety dispatch.',
    weatherAlertLabel: 'IMD orange alert (rain)',
    weatherAlertNote: 'Calls now include: If roads near you are unsafe because of rain, please press 2.',
    activeRequestsTitle: 'Active Requests',
    noRequests: 'No active blood requests at this centre.',
    roundPrefix: 'Round',
    screeningNote: 'Accept only after your own screening. U2U never decides eligibility.',
    pausedWarning: 'Enough donors on the way. Calling paused. U2U will call again if someone drops out.',
    fulfilledBanner: 'Target units clinically accepted. Request Fulfilled.',
    acceptButton: 'Accept',
    deferButton: 'Defer',
    deferDialogTitle: 'Defer Donor',
    deferDialogDesc: 'Record temporary medical or travel deferral. You may optionally specify when they will be eligible to donate again.',
    deferReturnDateLabel: 'Optional return date',
    deferCancel: 'Cancel',
    deferConfirm: 'Confirm deferral',
    deferring: 'Deferring...',
    accepting: 'Accepting...',
    tabCalls: 'Active Calls',
    tabTimeline: 'Live Timeline',
    timelineTitle: 'Live Dispatch Timeline',
    noCalls: 'No donor calls active for this request.',
    callsLabel: 'Donor Calls',
  },
  // Donor call simulator screen
  sim: {
    title: 'Donor Call Simulator',
    subtitle: 'Simulate automated emergency voice calls to consented donors.',
    demoNote: 'Demo simulator. In the live system this is a real phone call.',
    ringingCallsTitle: 'Incoming Calls (Ringing)',
    noRingingCalls: 'Raise a request on the Hospital screen, or press Run the story.',
    donorAliasLabel: 'Donor',
    langLabel: 'Language',
    callIncoming: 'Incoming emergency outreach call',
    connected: 'Call connected',
    mapLink: 'Open directions in Google Maps',
    answerAnother: 'Answer another ringing call',
    responsePress1: 'Thank you. Please go to',
    responsePress2: 'Thank you for telling us.',
    responsePress9: "You won't be called again.",
    responseLateAccept: 'Thank you, we already have enough donors.',
    openHospital: 'Open Hospital screen',
    runStory: 'Run the story',
  },
  // Request Desk screen
  desk: {
    title: 'Public Request Desk',
    subtitle: 'Paste a forwarded blood request to verify with Gemini Flash and deterministic code checks.',
    textareaLabel: 'Paste the message you received',
    textareaPlaceholder: 'Paste the full WhatsApp or SMS blood request here...',
    charCounter: 'characters',
    privacyNote: "We don't keep your message. Only the extracted details are checked.",
    checkButton: 'Check message',
    checking: 'Checking…',
    trySampleTitle: 'Try a sample message',
    verifiedMatch: 'This request is verified. Donors are already being called.',
    statusLink: 'Check live request status',
    sentToHospital: "We've asked {hospitalName}'s blood bank to confirm. Please also call them.",
    notVerified: "Couldn't verify. Please call the hospital directly.",
    paymentWarning: 'This message mentions payment. Blood donation in India is voluntary and unpaid.',
    errorGeneric: "Couldn't check right now. Please call the hospital.",
    mandatoryFooterEn: 'Nobody may charge you for a donor.',
    mandatoryFooterTa: 'இரத்த தானத்திற்கு யாரும் உங்களிடம் கட்டணம் வசூலிக்கக் கூடாது.',
    reviewLink: 'Review at blood bank (demo)',
  },
  // Donor join & consent screen
  join: {
    title: 'Join as a Consented Donor',
    subtitle:
      'Register your voluntary consent to receive automated phone calls when someone near you has an emergency need for your blood group.',
    privacyNoticeTitle: 'What we collect and why',
    privacyNoticeWhat:
      'What we collect: Your name, mobile number, blood group, area/pincode, and optional last donation date.',
    privacyNoticeWhy:
      'Why: Exclusively to place automated outreach calls during urgent clinical shortages matching your group and locality.',
    privacyNoticeWithdraw:
      'How to withdraw: Press 9 on any automated phone call to opt out instantly, or contact us.',
    grievanceContact: 'Grievance Officer: grievance@uyir2uyir.org',
    nameLabel: 'Full name',
    namePlaceholder: 'e.g. Ramesh Kumar',
    phoneLabel: 'Mobile number (10-digit Indian mobile)',
    phonePlaceholder: 'e.g. 98765 43210',
    bloodGroupLabel: 'Blood group',
    bloodGroupPlaceholder: 'Select your blood group',
    areaLabel: 'Area / Locality / PIN',
    areaPlaceholder: 'e.g. T. Nagar, Chennai',
    langLabel: 'Preferred call language',
    lastDonationLabel: 'Last donation date (optional)',
    consentUrgentLabel: 'U2U may call me when someone near me needs my blood group.',
    consentHistoryLabel: "U2U may keep my donation history so I'm not called too early.",
    consentAdultLabel: 'I confirm that I am 18 years of age or older.',
    joinButton: 'Join',
    joining: 'Joining…',
    successTitle:
      "You're in. Your donor name is {donorAlias}. You'll only be called when you match and it's safe for you to donate.",
    demoDisclaimer: 'Demo: nothing is sent and no call will be made.',
    phoneError: 'Please enter a valid 10-digit Indian mobile number.',
    nameError: 'Please enter your name.',
    areaError: 'Please enter your area or pin code.',
    bloodGroupError: 'Please select your blood group.',
  },
  // Coordination Impact metrics
  impact: {
    simulatedBadge: 'Simulated data from demo runs',
    title: 'Coordination Impact',
    subtitle:
      'Real-time efficiency metrics comparing U2U round-based IVR dispatch against the uncoordinated broadcast baseline.',
    timeToFirstOnTheWay: 'Time to first donor on the way',
    timeToCovered: 'Time to covered',
    timeToFulfilled: 'Time to fulfilled',
    baselinePrefix: 'Baseline: {minutes}m (broadcast)',
    faster: '{pct}% faster',
    callsPerAcceptedTitle: 'Calls per accepted donor',
    callsPerAcceptedDesc: 'Average IVR calls placed per clinically accepted donor',
    standDownReachTitle: 'Stand-down reach',
    standDownReachDesc: 'En route and late donors notified immediately upon pause or fulfillment',
    requestsProcessedTitle: 'Requests processed',
    requestsProcessedDesc: 'Simulated emergency blood requests tracked across demo sessions',
    emptyNotice:
      'No completed demo runs recorded yet. Press "Run the story" in the banner to execute the 5-step scenario and generate live metrics.',
    runStoryAction: 'Run the story',
  },
  // Evaluation Benchmarks
  eval: {
    sampleBadge: 'Sample: replaced by the real backend eval run',
    title: 'AI Verification Benchmarks',
    subtitle:
      'Empirical safety and extraction metrics evaluating Gemini Flash against the labelled WhatsApp blood request dataset.',
    totalTests: 'Total evaluated',
    accuracy: 'Accuracy',
    paymentToHospital: 'Payment to hospital',
    paymentTarget: 'Target: 0',
    wrongHospitalIds: 'Wrong hospital IDs',
    wrongHospitalTarget: 'Target: 0',
    p95Latency: 'p95 latency',
    promptVersion: 'Prompt version: {version}',
    lastRunAt: 'Last run: {date}',
    tableTitle: 'Test Case Results',
    colId: 'Test ID',
    colExpected: 'Expected Decision',
    colGot: 'Extracted Decision',
    colStatus: 'Status',
    passBadge: 'PASS',
    failBadge: 'FAIL',
  },
}

export type TranslationKeys = typeof en
