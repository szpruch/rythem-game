import { useState, useEffect } from 'react'
import { ref, onValue, off, update, remove } from 'firebase/database'
import { db } from '../../firebase'

export default function WaitingRoom({ roomId, myPlayerId, onGameStart, onLeave }) {
  const [room, setRoom] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const handler = onValue(roomRef, snap => {
      if (!snap.exists()) { onLeave(); return }
      const data = snap.val()
      setRoom(data)
      if (data.status === 'lobby') onGameStart()
    })
    return () => off(roomRef, 'value', handler)
  }, [roomId])

  if (!room) return (
    <div className="min-h-screen bg-[#0d0d1f] flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">מתחבר...</p>
    </div>
  )

  const players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }))
  const isHost = room.hostId === myPlayerId
  const canStart = players.length >= 2

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  async function handleStart() {
    const order = shuffle(players.map(p => p.id))
    await update(ref(db, `rooms/${roomId}`), {
      status: 'lobby',
      playerOrder: order,
      turnIndex: 0,
      cyclesDone: 0,
      usedUrls: [],
      revealed: false,
      results: null,
      currentSong: null,
    })
  }

  async function handleLeave() {
    await remove(ref(db, `rooms/${roomId}/players/${myPlayerId}`))
    if (isHost) await remove(ref(db, `rooms/${roomId}`))
    onLeave()
  }

  function copyCode() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const gameModeLabel = room.config?.gameMode?.type === 'rounds'
    ? `${room.config.gameMode.value} סיבובים לכל שחקן`
    : `יעד ניקוד: ${room.config?.gameMode?.value}`

  return (
    <div className="min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-5">

        <div className="text-center" dir="rtl">
          <p className="text-gray-400 text-sm mb-1">קוד החדר</p>
          <button onClick={copyCode}
            className="text-5xl font-black text-white tracking-widest font-mono hover:text-indigo-400 transition">
            {roomId}
          </button>
          <p className="text-xs text-gray-500 mt-1">{copied ? '✓ הועתק!' : 'לחץ להעתקה'}</p>
          <p className="text-gray-500 text-xs mt-2">{room.config?.language === 'en' ? '🌍 English' : '🇮🇱 עברית'} · {gameModeLabel}</p>
        </div>

        {/* Players list */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col gap-2" dir="rtl">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold">שחקנים</h2>
            <span className="text-gray-400 text-sm">{players.length}/{room.config?.maxPlayers}</span>
          </div>
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-gray-200 text-sm">{p.name}</span>
              {p.id === room.hostId && <span className="text-xs text-indigo-400">מארח</span>}
              {p.id === myPlayerId && <span className="text-xs text-gray-500">(אתה)</span>}
            </div>
          ))}
          {players.length < (room.config?.maxPlayers || 4) && (
            <p className="text-gray-600 text-xs text-center pt-1">
              ממתין לעוד {room.config.maxPlayers - players.length} שחקנים...
            </p>
          )}
        </div>

        {isHost && (
          <button onClick={handleStart} disabled={!canStart}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl text-xl transition disabled:opacity-40 disabled:cursor-not-allowed">
            {canStart ? 'התחל משחק! 🎮' : 'ממתין לשחקנים...'}
          </button>
        )}
        {!isHost && (
          <div className="text-center text-gray-400 text-sm py-2 animate-pulse">
            ממתין למארח שיתחיל...
          </div>
        )}

        <button onClick={handleLeave}
          className="text-gray-600 hover:text-gray-400 text-sm text-center transition">
          {isHost ? '🗑 מחק חדר' : '← עזוב חדר'}
        </button>

      </div>
    </div>
  )
}
