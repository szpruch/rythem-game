import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const app = initializeApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
})

export const db = getDatabase(app)

export function getPlayerId() {
  let id = localStorage.getItem('rythem_pid')
  if (!id) {
    id = Math.random().toString(36).slice(2, 11)
    localStorage.setItem('rythem_pid', id)
  }
  return id
}

export function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const EMPTY_HINTS = {
  hebrewCount: 0,
  englishCount: 0,
  songSeconds: 0,
  fullPlay: false,
  paidClues: {},
  penalties: 0,
  freeHintUsed: false,
  audioEvent: null,
}
