import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth'

export type { Auth, User }
export type { FirebaseApp }
import {
  initializeFirestore,
  getFirestore,
  type Firestore,
} from 'firebase/firestore'

/**
 * Returns whether all essential Firebase configuration variables are provided in the environment.
 * Initialises strictly from VITE_FIREBASE_* env vars with no hardcoded fallback values in code.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  )
}

function getFirebaseConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID

  if (!apiKey || !projectId) {
    return null
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  }
}

let appInstance: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (appInstance) {
    return appInstance
  }
  const config = getFirebaseConfig()
  if (!config) {
    return null
  }
  appInstance = getApps().length === 0 ? initializeApp(config) : getApp()
  return appInstance
}

export function getFirebaseAuth(): Auth | null {
  if (authInstance) {
    return authInstance
  }
  const app = getFirebaseApp()
  if (!app) {
    return null
  }
  authInstance = getAuth(app)
  return authInstance
}

export function getFirebaseDb(): Firestore | null {
  if (dbInstance) {
    return dbInstance
  }
  const app = getFirebaseApp()
  if (!app) {
    return null
  }
  const dbName = import.meta.env.VITE_FIRESTORE_DB as string | undefined
  try {
    dbInstance = dbName ? initializeFirestore(app, {}, dbName) : getFirestore(app)
  } catch {
    dbInstance = dbName ? getFirestore(app, dbName) : getFirestore(app)
  }
  return dbInstance
}

/**
 * Retrieves the current Firebase ID token (or mock token if in mock/offline mode).
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth()
  if (auth && auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken(forceRefresh)
    } catch (err) {
      console.warn('Failed to retrieve Firebase ID token:', err)
    }
  }

  // Fallback for mock mode or offline demo testing
  if (typeof window !== 'undefined') {
    return localStorage.getItem('u2u_mock_token')
  }
  return null
}

/**
 * Returns the currently signed-in Firebase user, if any.
 */
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth()
  return auth?.currentUser ?? null
}

export type AuthStateCallback = (user: User | null) => void

export function onAuthChange(callback: AuthStateCallback): () => void {
  const auth = getFirebaseAuth()
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

export interface DemoLoginResult {
  ok: boolean
  uid: string
  role: 'hospital' | 'staff'
  claims?: Record<string, unknown>
}

/**
 * Signs in with Firebase anonymous authentication, calls the backend demo-role endpoint
 * to attach custom claims (hospital or staff), and force-refreshes the token so claims take effect.
 *
 * In mock mode / without Firebase config, simulates role assignment in local storage.
 */
export async function signInDemoRole(role: 'hospital' | 'staff'): Promise<DemoLoginResult> {
  const auth = getFirebaseAuth()

  if (!auth) {
    // Mock / offline fallback when Firebase env vars are not set
    if (typeof window !== 'undefined') {
      localStorage.setItem('u2u_demo_role', role)
      localStorage.setItem('u2u_mock_token', `mock:${role}`)
    }
    return {
      ok: true,
      uid: `mock-user-${role}`,
      role,
      claims: {
        role,
        env: 'demo',
        hospitalId: role === 'hospital' ? 'hosp-sample' : null,
        centreId: role === 'staff' ? 'centre-central' : null,
      },
    }
  }

  // 1. Sign in anonymously with Firebase Auth
  const userCredential = await signInAnonymously(auth)
  const initialToken = await userCredential.user.getIdToken()

  // 2. Call backend /auth/demo-role to assign custom claims
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
  const response = await fetch(`${apiBaseUrl}/auth/demo-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${initialToken}`,
    },
    body: JSON.stringify({ role }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as { detail?: string }
    const message = errorBody.detail || `Failed to assign demo role (HTTP ${response.status})`
    throw new Error(message)
  }

  const result = await response.json() as { ok: boolean; uid: string; claims: Record<string, unknown> }

  // 3. Force-refresh the ID token so the client bundle has the new custom claims immediately
  await userCredential.user.getIdToken(true)

  if (typeof window !== 'undefined') {
    localStorage.setItem('u2u_demo_role', role)
  }

  return {
    ok: true,
    uid: userCredential.user.uid,
    role,
    claims: result.claims,
  }
}

/**
 * Signs out the current user and clears local demo storage.
 */
export async function signOutCurrentUser(): Promise<void> {
  const auth = getFirebaseAuth()
  if (auth) {
    await signOut(auth)
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('u2u_demo_role')
    localStorage.removeItem('u2u_mock_token')
  }
}
