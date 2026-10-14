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
  common: {
    loading: 'Loading...',
    simulatedBadge: 'Simulated',
  },
}

export type TranslationKeys = typeof en
