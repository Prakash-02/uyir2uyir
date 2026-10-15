import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  collectionGroup,
  type DocumentData,
} from 'firebase/firestore'
import { getFirebaseDb } from '../../lib/firebase'
import type { Unsubscribe } from '../client'
import type {
  BloodRequest,
  Call,
  TimelineEvent,
  BloodGroup,
  Component,
  RequestStatus,
  CallState,
  Lang,
} from '../types'

function mapBloodRequest(id: string, data: DocumentData): BloodRequest {
  return {
    id,
    hospitalId: String(data.hospitalId ?? ''),
    hospitalName: String(data.hospitalName ?? ''),
    centreId: String(data.centreId ?? ''),
    centreName: String(data.centreName ?? ''),
    bloodGroup: (data.bloodGroup as BloodGroup) ?? 'O+',
    component: (data.component as Component) ?? 'WHOLE_BLOOD',
    unitsNeeded: Number(data.unitsNeeded ?? 0),
    status: (data.status as RequestStatus) ?? 'OPEN',
    accepted: Number(data.accepted ?? 0),
    onTheWay: Number(data.onTheWay ?? 0),
    round: Number(data.round ?? 1),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
    expiresAt: String(data.expiresAt ?? new Date().toISOString()),
    isSimulated: Boolean(data.isSimulated),
    patientRef: data.patientRef ? String(data.patientRef) : undefined,
  }
}

function mapCall(id: string, requestId: string, data: DocumentData): Call {
  return {
    id,
    requestId: String(data.requestId ?? requestId),
    donorAlias: String(data.donorAlias ?? ''),
    bloodGroup: (data.bloodGroup as BloodGroup) ?? 'O+',
    lang: (data.lang as Lang) ?? 'en',
    state: (data.state as CallState) ?? 'UNKNOWN',
    round: Number(data.round ?? 1),
    etaMinutes: data.etaMinutes !== undefined && data.etaMinutes !== null ? Number(data.etaMinutes) : null,
    distanceKm: Number(data.distanceKm ?? 0),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  }
}

function mapTimelineEvent(id: string, requestId: string, data: DocumentData): TimelineEvent {
  return {
    id,
    requestId: String(data.requestId ?? requestId),
    at: String(data.at ?? new Date().toISOString()),
    kind: String(data.kind ?? 'EVENT'),
    text: String(data.text ?? ''),
  }
}

/**
 * Subscribes to a single blood request document by ID in Firestore.
 */
export function subscribeRequest(
  id: string,
  cb: (request: BloodRequest | null) => void,
): Unsubscribe {
  const db = getFirebaseDb()
  if (!db) {
    cb(null)
    return () => {}
  }

  const docRef = doc(db, 'requests', id)
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        cb(null)
        return
      }
      cb(mapBloodRequest(snapshot.id, snapshot.data()))
    },
    (err) => {
      console.warn(`Firestore subscribeRequest error on ${id}:`, err)
    },
  )
}

/**
 * Subscribes to calls subcollection for a given request: requests/{requestId}/calls.
 */
export function subscribeCalls(
  requestId: string,
  cb: (calls: Call[]) => void,
): Unsubscribe {
  const db = getFirebaseDb()
  if (!db) {
    cb([])
    return () => {}
  }

  const callsRef = collection(db, 'requests', requestId, 'calls')
  return onSnapshot(
    callsRef,
    (snapshot) => {
      const calls = snapshot.docs.map((d) => mapCall(d.id, requestId, d.data()))
      cb(calls)
    },
    (err) => {
      console.warn(`Firestore subscribeCalls error on request ${requestId}:`, err)
    },
  )
}

/**
 * Subscribes to timeline events subcollection: requests/{requestId}/events.
 */
export function subscribeEvents(
  requestId: string,
  cb: (events: TimelineEvent[]) => void,
): Unsubscribe {
  const db = getFirebaseDb()
  if (!db) {
    cb([])
    return () => {}
  }

  const eventsRef = collection(db, 'requests', requestId, 'events')
  const q = query(eventsRef, orderBy('at', 'asc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const events = snapshot.docs.map((d) => mapTimelineEvent(d.id, requestId, d.data()))
      cb(events)
    },
    (err) => {
      console.warn(`Firestore subscribeEvents error on request ${requestId}:`, err)
    },
  )
}

/**
 * Subscribes to requests collection filtered by hospitalId or centreId.
 */
export function subscribeRequests(
  filter: { hospitalId?: string; centreId?: string },
  cb: (requests: BloodRequest[]) => void,
): Unsubscribe {
  const db = getFirebaseDb()
  if (!db) {
    cb([])
    return () => {}
  }

  const reqsRef = collection(db, 'requests')
  let q = query(reqsRef)

  if (filter.hospitalId) {
    q = query(reqsRef, where('hospitalId', '==', filter.hospitalId))
  } else if (filter.centreId) {
    q = query(reqsRef, where('centreId', '==', filter.centreId))
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const reqs = snapshot.docs.map((d) => mapBloodRequest(d.id, d.data()))
      cb(reqs)
    },
    (err) => {
      console.warn('Firestore subscribeRequests error:', err)
    },
  )
}

/**
 * Subscribes to all active RINGING calls across requests using a collectionGroup query (for demo IVR simulator).
 */
export function subscribeSimCalls(cb: (calls: Call[]) => void): Unsubscribe {
  const db = getFirebaseDb()
  if (!db) {
    cb([])
    return () => {}
  }

  const callsGroup = collectionGroup(db, 'calls')
  const q = query(callsGroup, where('state', '==', 'RINGING'))

  return onSnapshot(
    q,
    (snapshot) => {
      const calls = snapshot.docs.map((d) =>
        mapCall(d.id, String(d.data().requestId ?? ''), d.data()),
      )
      cb(calls)
    },
    (err) => {
      console.warn('Firestore subscribeSimCalls error:', err)
    },
  )
}
