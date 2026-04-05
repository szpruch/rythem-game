import { useState, useEffect } from 'react'
import { ref, onValue, off, set, get } from 'firebase/database'
import { db, getPlayerId, genRoomId, EMPTY_HINTS } from '../../firebase'

const cardCls = 'bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3'

export default function OnlineLobby({ songsHe, songsEn, csvYearsHe, csvYearsEn, onJoin, onBack }) {
  const [view, setView] = useState('list')        // 'list' | 'create'
  const [rooms, setRooms] = useState([])
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('rythem_pname') || '')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Create room config
  const [language, setLanguage] = useState('he')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [mode, setMode] = useState('rounds')
  const [roundsValue, setRoundsValue] = useState(5)
  const [scoreValue, setScoreValue] = useState(50)
  const [minYear, setMinYear] = useState(null)
  const [maxYear, setMaxYear] = useState(null)
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false)
  const [maxTurnTime, setMaxTurnTime] = useState(120) // seconds
  const [challengeEnabled, setChallengeEnabled] = useState(true)

  const csvYears = language === 'en' ? csvYearsEn : csvYearsHe

  // Reset year range when language or csvYears changes
  useEffect(() => {
    if (csvYears) { setMinYear(csvYears.min); setMaxYear(csvYears.max) }
  }, [csvYears])

  // Subscribe to open rooms
  useEffect(() => {
    const roomsRef = ref(db, 'rooms')
    const handler = onValue(roomsRef, snap => {
      if (!snap.exists()) { setRooms([]); return }
      const now = Date.now()
      const list = Object.entries(snap.val())
        .filter(([, r]) => ['waiting', 'lobby', 'guessing', 'revealed'].includes(r.status) && (now - (r.createdAt || 0)) < 12 * 60 * 60 * 1000 && Object.keys(r.players || {}).length > 0)
        .map(([id, r]) => ({ id, ...r }))
      setRooms(list)
    })
    return () => off(roomsRef, 'value', handler)
  }, [])

  function saveName(name) {
    setPlayerName(name)
    localStorage.setItem('rythem_pname', name)
  }

  async function joinRoom(roomId) {
    if (!playerName.trim()) { setError('יש להזין שם שחקן'); return }
    setLoading(true); setError('')
    const playerId = getPlayerId()
    await set(ref(db, `rooms/${roomId}/players/${playerId}`), { name: playerName.trim(), score: 0 })
    onJoin(roomId, playerId, playerName.trim())
    setLoading(false)
  }

  async function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setLoading(true); setError('')
    const snap = await get(ref(db, `rooms/${code}`))
    if (!snap.exists()) { setError('קוד לא נמצא'); setLoading(false); return }
    const room = snap.val()
    if (room.status !== 'waiting') { setError('החדר כבר התחיל'); setLoading(false); return }
    const playerCount = Object.keys(room.players || {}).length
    if (playerCount >= room.config.maxPlayers) { setError('החדר מלא'); setLoading(false); return }
    await joinRoom(code)
  }

  async function handleCreateRoom() {
    if (!playerName.trim()) { setError('יש להזין שם שחקן'); return }
    setLoading(true); setError('')
    const playerId = getPlayerId()
    const roomId = genRoomId()
    const gameMode = mode === 'rounds' ? { type: 'rounds', value: roundsValue } : { type: 'score', value: scoreValue }
    const yearRange = csvYears && minYear !== null && maxYear !== null ? { min: minYear, max: maxYear } : null
    await set(ref(db, `rooms/${roomId}`), {
      status: 'waiting',
      hostId: playerId,
      createdAt: Date.now(),
      config: { language, gameMode, maxPlayers, yearRange, maxTurnTime: timeLimitEnabled ? maxTurnTime : null, challengeEnabled },
      players: { [playerId]: { name: playerName.trim(), score: 0 } },
      hints: EMPTY_HINTS,
      turnIndex: 0,
      cyclesDone: 0,
      revealed: false,
      results: null,
      usedUrls: [],
      currentSong: null,
      playerOrder: [],
    })
    onJoin(roomId, playerId, playerName.trim())
    setLoading(false)
  }

  const gameModeLabel = (config) => {
    if (!config?.gameMode) return ''
    return config.gameMode.type === 'rounds'
      ? `${config.gameMode.value} סיבובים`
      : `יעד: ${config.gameMode.value}`
  }

  return (
    <div className="min-h-screen bg-[#0d0d1f] flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-md flex flex-col gap-4 px-5 py-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition text-sm flex items-center gap-1">
            ← חזור
          </button>
          <h1 className="text-xl font-bold text-white" dir="rtl">🌐 שחק אונליין</h1>
          <div className="w-12" />
        </div>

        {/* Player name */}
        <div className={cardCls} dir="rtl">
          <label className="text-white font-bold text-sm">השם שלך</label>
          <input
            value={playerName}
            onChange={e => saveName(e.target.value)}
            onFocus={e => e.target.select()}
            placeholder="הכנס שם..."
            dir="rtl"
            className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500 text-right"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setView('list')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            חדרים פתוחים
          </button>
          <button onClick={() => setView('create')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${view === 'create' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            + צור חדר
          </button>
        </div>

        {view === 'list' && (
          <>
            {/* Join by code */}
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="קוד חדר..."
                maxLength={5}
                className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500 text-center tracking-widest font-mono uppercase"
              />
              <button onClick={handleJoinByCode} disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition disabled:opacity-50">
                הצטרף
              </button>
            </div>

            {/* Room list */}
            {rooms.length === 0 ? (
              <div className="text-center text-gray-500 py-8">אין חדרים פתוחים כרגע</div>
            ) : (
              <div className="flex flex-col gap-2">
                {rooms.map(room => {
                  const playerCount = Object.keys(room.players || {}).length
                  const isFull = playerCount >= room.config?.maxPlayers
                  return (
                    <div key={room.id} dir="rtl"
                      className={`border rounded-2xl px-4 py-3 flex items-center justify-between ${room.status === 'waiting' ? 'bg-gray-900 border-gray-700' : 'bg-gray-900/50 border-gray-700/50'}`}>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span>{room.config?.language === 'en' ? '🌍' : '🇮🇱'}</span>
                          <span className="text-white font-bold text-sm">
                            {Object.values(room.players || {})[0]?.name || 'מארח'}
                          </span>
                          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full font-mono">{room.id}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{gameModeLabel(room.config)}</span>
                          <span>{playerCount}/{room.config?.maxPlayers} שחקנים</span>
                        </div>
                      </div>
                      {room.status === 'waiting' ? (
                        <button
                          onClick={() => joinRoom(room.id)}
                          disabled={isFull || loading}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {isFull ? 'מלא' : 'הצטרף'}
                        </button>
                      ) : (
                        <span className="text-xs bg-orange-900/50 text-orange-400 border border-orange-700/50 px-2 py-1 rounded-xl flex-shrink-0">🎮 פעיל</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {view === 'create' && (
          <>
            {/* Language */}
            <div className={cardCls} dir="rtl">
              <h2 className="text-white font-bold">שפה</h2>
              <div className="flex gap-2">
                <button onClick={() => setLanguage('he')}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${language === 'he' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  🇮🇱 עברית
                </button>
                <button onClick={() => setLanguage('en')}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  🌍 English
                </button>
              </div>
            </div>

            {/* Players */}
            <div className={cardCls} dir="rtl">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold">מקסימום שחקנים</h2>
                <div className="flex items-center gap-4">
                  <button onClick={() => setMaxPlayers(v => Math.max(2, v - 1))}
                    className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold flex items-center justify-center transition">−</button>
                  <span className="text-2xl font-black text-white w-6 text-center">{maxPlayers}</span>
                  <button onClick={() => setMaxPlayers(v => Math.min(9, v + 1))}
                    className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-bold flex items-center justify-center transition">+</button>
                </div>
              </div>
            </div>

            {/* Game mode */}
            <div className={cardCls} dir="rtl">
              <h2 className="text-white font-bold">מצב משחק</h2>
              <div className="flex gap-2">
                <button onClick={() => setMode('rounds')}
                  className={`flex-1 py-1.5 rounded-xl font-bold text-sm transition ${mode === 'rounds' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  מספר סיבובים
                </button>
                <button onClick={() => setMode('score')}
                  className={`flex-1 py-1.5 rounded-xl font-bold text-sm transition ${mode === 'score' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  יעד ניקוד
                </button>
              </div>
              {mode === 'rounds' ? (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">סיבובים לכל שחקן</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setRoundsValue(v => Math.max(1, v - 1))}
                      className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center transition">−</button>
                    <span className="text-white font-bold w-5 text-center">{roundsValue}</span>
                    <button onClick={() => setRoundsValue(v => Math.min(20, v + 1))}
                      className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">ניקוד לניצחון</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setScoreValue(v => Math.max(10, v - 10))}
                      className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center transition">−</button>
                    <span className="text-white font-bold w-9 text-center">{scoreValue}</span>
                    <button onClick={() => setScoreValue(v => Math.min(200, v + 10))}
                      className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
                  </div>
                </div>
              )}
            </div>

            {/* Time limit */}
            <div className={cardCls} dir="rtl">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold">הגבלת זמן לתור</h2>
                <button onClick={() => setTimeLimitEnabled(v => !v)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${timeLimitEnabled ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${timeLimitEnabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
              {timeLimitEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">זמן מקסימלי לתור</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMaxTurnTime(v => Math.max(30, v - 30))}
                      className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center transition">−</button>
                    <span className="text-white font-bold w-12 text-center">
                      {maxTurnTime < 60 ? `${maxTurnTime}ש` : `${Math.floor(maxTurnTime / 60)}:${String(maxTurnTime % 60).padStart(2, '0')}`}
                    </span>
                    <button onClick={() => setMaxTurnTime(v => Math.min(240, v + 30))}
                      className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
                  </div>
                </div>
              )}
            </div>

            {/* Challenge option */}
            <div className={cardCls} dir="rtl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold">אתגר ⚔️</h2>
                  <p className="text-gray-500 text-xs mt-0.5">שחקנים יכולים לאתגר תשובות לאחר כל תור</p>
                </div>
                <button onClick={() => setChallengeEnabled(v => !v)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${challengeEnabled ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${challengeEnabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Year range */}
            {csvYears && minYear !== null && maxYear !== null && (
              <div className={cardCls} dir="rtl">
                <h2 className="text-white font-bold">טווח שנים</h2>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">מינימום</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMinYear(v => Math.max(csvYears.min, v - 1))}
                      className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center transition">−</button>
                    <span className="text-white font-bold w-12 text-center">{minYear}</span>
                    <button onClick={() => setMinYear(v => Math.min(maxYear - 1, v + 1))}
                      className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">מקסימום</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMaxYear(v => Math.max(minYear + 1, v - 1))}
                      className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center transition">−</button>
                    <span className="text-white font-bold w-12 text-center">{maxYear}</span>
                    <button onClick={() => setMaxYear(v => Math.min(csvYears.max, v + 1))}
                      className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleCreateRoom} disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl text-xl transition shadow-lg shadow-emerald-600/30 disabled:opacity-50">
              צור חדר 🚀
            </button>
          </>
        )}

      </div>
    </div>
  )
}
