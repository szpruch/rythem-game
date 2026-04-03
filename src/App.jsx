import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import SongCard from './components/SongCard'

const BG = 'min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6'

export default function App() {
  const [songs, setSongs] = useState([])
  const [usedIds, setUsedIds] = useState(new Set())
  const [currentSong, setCurrentSong] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [gameOver, setGameOver] = useState(false)
  const [round, setRound] = useState(0)
  const [totalScore, setTotalScore] = useState(0)

  useEffect(() => {
    fetch('/SongRiddle.csv')
      .then(r => r.text())
      .then(text => {
        const result = Papa.parse(text, { header: true, skipEmptyLines: true })
        setSongs(result.data)
        setLoading(false)
      })
  }, [])

  function pickRandomSong(songList, used) {
    const available = songList.filter(s => !used.has(s.youtube_url))
    if (available.length === 0) return null
    return available[Math.floor(Math.random() * available.length)]
  }

  function startGame() {
    const newUsed = new Set()
    const song = pickRandomSong(songs, newUsed)
    setUsedIds(newUsed)
    setCurrentSong(song)
    setRevealed(false)
    setGameOver(false)
    setRound(1)
    setTotalScore(0)
  }

  function nextSong() {
    const newUsed = new Set(usedIds)
    newUsed.add(currentSong.youtube_url)
    const song = pickRandomSong(songs, newUsed)
    setUsedIds(newUsed)
    if (!song) {
      setGameOver(true)
      setCurrentSong(null)
    } else {
      setCurrentSong(song)
      setRevealed(false)
      setRound(r => r + 1)
    }
  }

  if (loading) {
    return (
      <div className={BG}>
        <p className="text-gray-400 text-xl animate-pulse">Loading songs...</p>
      </div>
    )
  }

  if (!currentSong && !gameOver) {
    return (
      <div className={BG}>
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <p className="text-6xl mb-4">🎵</p>
            <h1 className="text-5xl font-bold text-white tracking-tight">Rythem</h1>
            <p className="text-gray-500 mt-3 text-lg">{songs.length} songs ready</p>
          </div>
          <button
            onClick={startGame}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-12 py-4 rounded-2xl text-xl transition shadow-lg shadow-indigo-600/30"
          >
            Start Game
          </button>
        </div>
      </div>
    )
  }

  if (gameOver) {
    return (
      <div className={BG}>
        <div className="flex flex-col items-center gap-6 text-center">
          <p className="text-6xl">🏁</p>
          <h1 className="text-4xl font-bold text-white">All Songs Played!</h1>
          <p className="text-gray-400 text-lg">You went through all {songs.length} songs.</p>
          <button
            onClick={startGame}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-10 py-4 rounded-2xl text-xl transition"
          >
            Play Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={BG}>
      <SongCard
        key={currentSong.youtube_url}
        song={currentSong}
        revealed={revealed}
        onDone={(roundScore) => { setTotalScore(s => s + roundScore); setRevealed(true) }}
        onNext={nextSong}
        round={round}
        totalScore={totalScore}
      />
    </div>
  )
}
