import { useState, useEffect } from 'react'
import { ref, get, remove } from 'firebase/database'
import { db, getPlayerId } from './firebase'
import OnlineLobby from './components/online/OnlineLobby'
import WaitingRoom from './components/online/WaitingRoom'
import OnlineGame from './components/online/OnlineGame'

const SESSION_KEY = 'rythem_session'
const saveSession = roomId => localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId }))
const clearSession = () => localStorage.removeItem(SESSION_KEY)

export default function OnlineApp({ songsHe, songsEn, csvYearsHe, csvYearsEn, onBack }) {
  const [phase, setPhase] = useState('loading') // 'loading' | 'rejoin' | 'lobby' | 'waiting' | 'game'
  const [roomId, setRoomId] = useState(null)
  const [myPlayerId, setMyPlayerId] = useState(null)
  const [rejoinInfo, setRejoinInfo] = useState(null) // { roomId, playerId, status }

  // On mount: check for a saved session and validate it against Firebase
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) { setPhase('lobby'); return }
    try {
      const { roomId } = JSON.parse(raw)
      const playerId = getPlayerId()
      get(ref(db, `rooms/${roomId}`))
        .then(snap => {
          if (!snap.exists()) { clearSession(); setPhase('lobby'); return }
          const room = snap.val()
          if (room.status === 'finished' || !room.players?.[playerId]) {
            clearSession(); setPhase('lobby'); return
          }
          setRejoinInfo({ roomId, playerId, status: room.status })
          setPhase('rejoin')
        })
        .catch(() => { clearSession(); setPhase('lobby') })
    } catch {
      clearSession(); setPhase('lobby')
    }
  }, [])

  function handleJoin(roomId, playerId) {
    saveSession(roomId)
    setRoomId(roomId)
    setMyPlayerId(playerId)
    setPhase('waiting')
  }

  function handleGameStart() {
    setPhase('game')
  }

  function handleLeave() {
    clearSession()
    setRoomId(null)
    setMyPlayerId(null)
    setPhase('lobby')
  }

  function handleRejoin() {
    const { roomId, playerId, status } = rejoinInfo
    saveSession(roomId)
    setRoomId(roomId)
    setMyPlayerId(playerId)
    setRejoinInfo(null)
    setPhase(status === 'waiting' ? 'waiting' : 'game')
  }

  async function handleDismissRejoin() {
    const { roomId, playerId } = rejoinInfo
    clearSession()
    setRejoinInfo(null)
    setPhase('lobby')
    // Remove player from Firebase so they don't leave a zombie entry
    await remove(ref(db, `rooms/${roomId}/players/${playerId}`))
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0d1f] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">טוען...</p>
      </div>
    )
  }

  if (phase === 'rejoin') {
    return (
      <div className="min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6">
        <div className="bg-gray-900 border border-indigo-700/50 rounded-3xl p-8 max-w-sm w-full flex flex-col gap-5 text-center" dir="rtl"
          style={{ animation: 'popIn 0.4s ease-out' }}>
          <p className="text-5xl">🔄</p>
          <h2 className="text-2xl font-bold text-white">חזרת!</h2>
          <p className="text-gray-400 text-sm">נמצא משחק פעיל שיצאת ממנו.</p>
          <div className="bg-gray-800 rounded-xl px-4 py-3">
            <p className="text-gray-500 text-xs mb-1">קוד חדר</p>
            <p className="text-white font-mono font-bold text-2xl tracking-widest">{rejoinInfo.roomId}</p>
          </div>
          <button onClick={handleRejoin}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl text-xl transition shadow-lg shadow-indigo-600/30">
            חזור למשחק ↩
          </button>
          <button onClick={handleDismissRejoin}
            className="text-gray-500 hover:text-gray-300 text-sm transition">
            לא, צא מהמשחק
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'lobby') {
    return (
      <OnlineLobby
        songsHe={songsHe} songsEn={songsEn}
        csvYearsHe={csvYearsHe} csvYearsEn={csvYearsEn}
        onJoin={handleJoin} onBack={onBack}
      />
    )
  }

  if (phase === 'waiting') {
    return (
      <WaitingRoom
        roomId={roomId} myPlayerId={myPlayerId}
        onGameStart={handleGameStart} onLeave={handleLeave}
      />
    )
  }

  return (
    <OnlineGame
      roomId={roomId} myPlayerId={myPlayerId}
      songsHe={songsHe} songsEn={songsEn}
      onLeave={handleLeave}
    />
  )
}
