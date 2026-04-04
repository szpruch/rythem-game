import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import SongCard from './components/SongCard'
import SetupPage from './components/SetupPage'
import LobbyPage from './components/LobbyPage'
import Confetti from './components/Confetti'

const BG = 'min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function computeYears(songs) {
  const years = songs.map(s => parseInt(s.publish_year, 10)).filter(y => !isNaN(y))
  return years.length ? { min: Math.min(...years), max: Math.max(...years) } : null
}

export default function App() {
  const [songsHe, setSongsHe] = useState([])
  const [songsEn, setSongsEn] = useState([])
  const [loading, setLoading] = useState(true)

  // Active song pool for the current game
  const [activeSongs, setActiveSongs] = useState([])

  // phase: 'setup' | 'lobby' | 'playing' | 'end'
  const [phase, setPhase] = useState('setup')
  const [players, setPlayers] = useState([])
  const [playerOrder, setPlayerOrder] = useState([])
  const [turnIndex, setTurnIndex] = useState(0)
  const [cyclesDone, setCyclesDone] = useState(0)
  const [gameMode, setGameMode] = useState({ type: 'rounds', value: 5 })
  const [usedUrls, setUsedUrls] = useState(new Set())
  const [currentSong, setCurrentSong] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [yearRange, setYearRange] = useState(null)

  const csvYearsHe = useMemo(() => computeYears(songsHe), [songsHe])
  const csvYearsEn = useMemo(() => computeYears(songsEn), [songsEn])

  useEffect(() => {
    Promise.all([
      fetch('/SongRiddle.csv').then(r => r.text()),
      fetch('/SongRiddleEnglishVersion.csv').then(r => r.text()),
    ]).then(([he, en]) => {
      setSongsHe(Papa.parse(he, { header: true, skipEmptyLines: true }).data)
      setSongsEn(Papa.parse(en, { header: true, skipEmptyLines: true }).data)
      setLoading(false)
    })
  }, [])

  function startGame(playerNames, mode, range, language) {
    const pool = language === 'en' ? songsEn : songsHe
    setActiveSongs(pool)
    setPlayers(playerNames.map(name => ({ name, score: 0 })))
    setPlayerOrder(shuffle(playerNames.map((_, i) => i)))
    setTurnIndex(0)
    setCyclesDone(0)
    setGameMode(mode)
    setYearRange(range)
    setUsedUrls(new Set())
    setCurrentSong(null)
    setRevealed(false)
    setPhase('lobby')
  }

  function handleReady() {
    const available = activeSongs.filter(s => {
      if (usedUrls.has(s.youtube_url)) return false
      if (yearRange) {
        const y = parseInt(s.publish_year, 10)
        if (isNaN(y) || y < yearRange.min || y > yearRange.max) return false
      }
      return true
    })
    if (available.length === 0) { setPhase('end'); return }
    const song = available[Math.floor(Math.random() * available.length)]
    setCurrentSong(song)
    setRevealed(false)
    setPhase('playing')
  }

  function handleDone(roundScore) {
    const idx = playerOrder[turnIndex]
    setPlayers(prev => prev.map((p, i) => i === idx ? { ...p, score: p.score + roundScore } : p))
    setRevealed(true)
  }

  function handleNext() {
    setUsedUrls(prev => new Set([...prev, currentSong.youtube_url]))
    const nextTurn = (turnIndex + 1) % playerOrder.length
    const newCycles = nextTurn === 0 ? cyclesDone + 1 : cyclesDone
    setTurnIndex(nextTurn)
    setCyclesDone(newCycles)

    if (gameMode.type === 'rounds' && newCycles >= gameMode.value) { setPhase('end'); return }
    if (gameMode.type === 'score') {
      const maxScore = Math.max(...players.map(p => p.score))
      if (maxScore >= gameMode.value) { setPhase('end'); return }
    }
    setPhase('lobby')
  }

  if (loading) {
    return (
      <div className={BG}>
        <p className="text-gray-400 text-xl animate-pulse">Loading songs...</p>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <SetupPage
        onStart={startGame}
        songsHe={songsHe}
        songsEn={songsEn}
        csvYearsHe={csvYearsHe}
        csvYearsEn={csvYearsEn}
      />
    )
  }

  if (phase === 'lobby') {
    return (
      <LobbyPage
        players={players}
        currentPlayerIdx={playerOrder[turnIndex]}
        gameMode={gameMode}
        cyclesDone={cyclesDone}
        onReady={handleReady}
      />
    )
  }

  if (phase === 'playing') {
    const currentPlayer = players[playerOrder[turnIndex]]
    return (
      <div className={BG}>
        <SongCard
          key={currentSong.youtube_url}
          song={currentSong}
          revealed={revealed}
          onDone={handleDone}
          onNext={handleNext}
          round={cyclesDone + 1}
          totalScore={currentPlayer.score}
          playerName={currentPlayer.name}
        />
      </div>
    )
  }

  if (phase === 'end') {
    const sorted = players.map((p, i) => ({ ...p, origIdx: i })).sort((a, b) => b.score - a.score)
    return (
      <div className={BG}>
        <Confetti />
        <div className="flex flex-col items-center gap-5 text-center w-full max-w-md relative z-10">
          <p className="text-7xl" style={{ animation: 'popIn 0.6s ease-out forwards' }}>🏆</p>
          <h1 className="text-4xl font-bold text-white" style={{ animation: 'popIn 0.6s 0.15s ease-out both' }}>
            המשחק נגמר!
          </h1>
          {players.length > 1 && (
            <p className="text-3xl text-yellow-400 font-black" style={{ animation: 'popIn 0.7s 0.3s ease-out both' }}>
              🎉 {sorted[0].name} ניצח! 🎉
            </p>
          )}
          <div className="w-full flex flex-col gap-2">
            {sorted.map((p, i) => (
              <div key={p.origIdx} dir="rtl"
                className={`flex items-center justify-between px-4 py-3 rounded-2xl ${
                  i === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800 border border-transparent'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <span className="text-white font-bold">{p.name}</span>
                </div>
                <span className={`font-black text-xl ${p.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => setPhase('setup')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-10 py-4 rounded-2xl text-xl transition">
            משחק חדש
          </button>
        </div>
      </div>
    )
  }
}
