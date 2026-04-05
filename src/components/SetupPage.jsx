import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'

function StatsModal({ songs, onClose }) {
  const { total, decades } = useMemo(() => {
    const counts = {}
    songs.forEach(s => {
      const y = parseInt(s.publish_year, 10)
      if (isNaN(y)) return
      const decade = Math.floor(y / 10) * 10
      counts[decade] = (counts[decade] || 0) + 1
    })
    const sorted = Object.entries(counts)
      .map(([d, c]) => ({ decade: parseInt(d, 10), count: c }))
      .sort((a, b) => a.decade - b.decade)
    return { total: songs.length, decades: sorted }
  }, [songs])

  const maxCount = Math.max(...decades.map(d => d.count), 1)

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-[#13132b] border border-indigo-900/50 rounded-3xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()} dir="rtl">

        <div className="sticky top-0 bg-[#13132b] border-b border-indigo-900/40 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-lg font-bold text-white">סטטיסטיקות</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none transition">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <p className="text-center text-gray-300 text-sm">
            סה"כ שירים במאגר: <span className="text-white font-black text-2xl mx-1">{total}</span>
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-indigo-400 text-xs font-bold uppercase tracking-wide">שירים לפי עשור</p>
            {decades.map(({ decade, count }) => (
              <div key={decade} className="flex items-center gap-3">
                <span className="text-gray-400 text-xs w-12 text-left flex-shrink-0">{decade}s</span>
                <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max(8, (count / maxCount) * 100)}%` }}
                  >
                    <span className="text-white text-xs font-bold">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function SetupPage({ onStart, onBack, songsHe = [], songsEn = [], csvYearsHe, csvYearsEn }) {
  const [language, setLanguage] = useState('he')
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState(
    Array.from({ length: 9 }, (_, i) => `שחקן.ית ${i + 1}`)
  )
  const [mode, setMode] = useState('rounds')
  const [roundsValue, setRoundsValue] = useState(5)
  const [scoreValue, setScoreValue] = useState(50)
  const [minYear, setMinYear] = useState(null)
  const [maxYear, setMaxYear] = useState(null)
  const [showStats, setShowStats] = useState(false)

  const songs = language === 'en' ? songsEn : songsHe
  const csvYears = language === 'en' ? csvYearsEn : csvYearsHe

  useEffect(() => {
    if (csvYears) { setMinYear(csvYears.min); setMaxYear(csvYears.max) }
  }, [csvYears])

  function setName(i, val) {
    setNames(prev => { const n = [...prev]; n[i] = val; return n })
  }

  function handleStart() {
    const playerNames = names.slice(0, playerCount).map((n, i) => n.trim() || `שחקן.ית ${i + 1}`)
    const gameMode = mode === 'rounds' ? { type: 'rounds', value: roundsValue } : { type: 'score', value: scoreValue }
    const yearRange = csvYears ? { min: minYear, max: maxYear } : null
    onStart(playerNames, gameMode, yearRange, language)
  }

  const cardCls = 'bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3'

  return (
    <div className="min-h-screen bg-[#0d0d1f] flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-md flex flex-col gap-3 px-5 py-6 my-auto">

        {showStats && <StatsModal songs={songs} onClose={() => setShowStats(false)} />}

        {/* Back button */}
        {onBack && (
          <button onClick={onBack} className="self-start text-gray-500 hover:text-gray-300 text-sm transition">
            ← חזור
          </button>
        )}

        {/* Language toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage('he')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${language === 'he' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            🇮🇱 עברית
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${language === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            🌍 English
          </button>
        </div>

        {/* Title + logo */}
        <div className="relative flex items-center justify-center mb-1">
          <h1 className="text-4xl font-black text-white tracking-tight" dir="rtl">
            🎵 חידון הקצב
          </h1>
          <button onClick={() => setShowStats(true)} className="absolute left-0 focus:outline-none">
            <img
              src="/Logo.jpg"
              alt="Maya & Tal"
              className="w-16 h-16 rounded-2xl object-cover shadow-lg hover:scale-105 transition-transform"
            />
          </button>
        </div>

        {/* Players */}
        <div className={cardCls} dir="rtl">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold">שחקנים</h2>
            <div className="flex items-center gap-4">
              <button onClick={() => setPlayerCount(c => Math.max(1, c - 1))}
                className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold flex items-center justify-center transition">−</button>
              <span className="text-2xl font-black text-white w-6 text-center">{playerCount}</span>
              <button onClick={() => setPlayerCount(c => Math.min(9, c + 1))}
                className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-bold flex items-center justify-center transition">+</button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: playerCount }, (_, i) => (
              <input key={i} value={names[i]} onChange={e => setName(i, e.target.value)}
                dir="rtl" placeholder={`שחקן.ית ${i + 1}`}
                className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500 text-right" />
            ))}
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
                <span className="text-white font-bold text-base w-5 text-center">{roundsValue}</span>
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
                <span className="text-white font-bold text-base w-9 text-center">{scoreValue}</span>
                <button onClick={() => setScoreValue(v => Math.min(200, v + 10))}
                  className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
              </div>
            </div>
          )}
        </div>

        {/* Year range — steppers */}
        {csvYears && minYear !== null && maxYear !== null && (
          <div className={cardCls} dir="rtl">
            <h2 className="text-white font-bold">טווח שנים</h2>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">שנה מינימלית</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setMinYear(v => Math.max(csvYears.min, v - 1))}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center transition">−</button>
                <input
                  type="number"
                  value={minYear}
                  onChange={e => setMinYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  onBlur={() => {
                    const v = parseInt(minYear, 10)
                    if (isNaN(v)) { setMinYear(csvYears.min); return }
                    setMinYear(Math.max(csvYears.min, Math.min(maxYear - 1, v)))
                  }}
                  className="w-16 bg-gray-800 text-white font-bold text-base text-center rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500 py-1"
                />
                <button onClick={() => setMinYear(v => Math.min(maxYear - 1, v + 1))}
                  className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">שנה מקסימלית</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setMaxYear(v => Math.max(minYear + 1, v - 1))}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold flex items-center justify-center transition">−</button>
                <input
                  type="number"
                  value={maxYear}
                  onChange={e => setMaxYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  onBlur={() => {
                    const v = parseInt(maxYear, 10)
                    if (isNaN(v)) { setMaxYear(csvYears.max); return }
                    setMaxYear(Math.max(minYear + 1, Math.min(csvYears.max, v)))
                  }}
                  className="w-16 bg-gray-800 text-white font-bold text-base text-center rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500 py-1"
                />
                <button onClick={() => setMaxYear(v => Math.min(csvYears.max, v + 1))}
                  className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition">+</button>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleStart}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl text-xl transition shadow-lg shadow-indigo-600/30">
          התחל משחק! 🎮
        </button>

      </div>
    </div>
  )
}
