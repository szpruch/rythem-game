import { useState, useEffect, useRef } from 'react'
import { getVideoId } from '../utils/youtube'
import { isCloseMatch, isYearMatch } from '../utils/fuzzy'
import YouTubePlayer from './YouTubePlayer'

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m} : ${String(s).padStart(2, '0')}`
}

function speak(text, lang) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  window.speechSynthesis.speak(utterance)
}

export default function SongCard({ song, revealed, onDone, onNext, round }) {
  const videoId = getVideoId(song.youtube_url)
  const playerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [hebrewCount, setHebrewCount] = useState(0)
  const [englishCount, setEnglishCount] = useState(0)
  const [guessTitle, setGuessTitle] = useState('')
  const [guessArtist, setGuessArtist] = useState('')
  const [guessYear, setGuessYear] = useState('')
  const [results, setResults] = useState(null)

  const hebrewLines = [song.hebrew_line_1, song.hebrew_line_2, song.hebrew_line_3].filter(Boolean)
  const englishLines = [song.english_line_1, song.english_line_2, song.english_line_3].filter(Boolean)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [isPlaying])

  function togglePlay() {
    isPlaying ? playerRef.current?.pause() : playerRef.current?.play()
  }

  function playForSeconds(s) {
    setElapsed(0)
    playerRef.current?.playForSeconds(s)
  }

  function handleEnglishLine(n) {
    const newCount = englishCount === n ? 0 : n
    setEnglishCount(newCount)
    if (newCount > 0) speak(englishLines.slice(0, newCount).join('. '), 'en-US')
  }

  function handleHebrewLine(n) {
    const newCount = hebrewCount === n ? 0 : n
    setHebrewCount(newCount)
    if (newCount > 0) speak(hebrewLines.slice(0, newCount).join('. '), 'he-IL')
  }

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4">
      <YouTubePlayer ref={playerRef} videoId={videoId} onPlayStateChange={setIsPlaying} />

      {/* Header */}
      <div className="text-center">
        <p className="text-gray-500 text-xs tracking-widest uppercase">Round {round}</p>
        <h2 className="text-2xl sm:text-4xl font-bold text-white mt-1">Guess the Song</h2>
      </div>

      {/* Elapsed timer */}
      <div className="text-center">
        <span className="text-4xl sm:text-6xl font-mono font-bold text-orange-400 tracking-wider">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">

        {/* English lines */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">English</p>
          {englishLines.map((_, i) => {
            const n = i + 1
            const active = englishCount >= n
            return (
              <button
                key={n}
                onClick={() => handleEnglishLine(n)}
                className={`w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl transition-all ${
                  active ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-cyan-900 hover:bg-cyan-800 text-white'
                }`}
              >
                Line {n}
              </button>
            )
          })}
        </div>

        {/* Hebrew lines */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">עברית</p>
          {hebrewLines.map((_, i) => {
            const n = i + 1
            const active = hebrewCount >= n
            return (
              <button
                key={n}
                onClick={() => handleHebrewLine(n)}
                className={`w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl transition-all ${
                  active ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-cyan-900 hover:bg-cyan-800 text-white'
                }`}
              >
                שורה {n}
              </button>
            )
          })}
        </div>

        {/* Duration buttons */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">Song</p>
          {[3, 6, 9].map(s => (
            <button
              key={s}
              onClick={() => playForSeconds(s)}
              className="w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl text-white bg-green-700 hover:bg-green-600 transition-all shadow-lg shadow-green-700/20"
            >
              {s}s
            </button>
          ))}
        </div>
      </div>

      {/* Fixed-height lyric panel */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 h-20 sm:h-24">
        <div className="bg-gray-800/60 rounded-2xl px-3 py-2 border border-cyan-900/40 flex flex-col justify-center overflow-hidden">
          <p className="text-xs text-cyan-500 uppercase tracking-widest mb-1">English</p>
          {englishCount > 0 ? (
            <div className="flex flex-col gap-0.5 overflow-hidden">
              {englishLines.slice(0, englishCount).map((line, i) => (
                <p key={i} className="text-gray-200 text-xs sm:text-sm leading-snug truncate">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-xs italic">No lines revealed</p>
          )}
        </div>
        <div className="bg-gray-800/60 rounded-2xl px-3 py-2 border border-cyan-900/40 flex flex-col justify-center overflow-hidden">
          <p className="text-xs text-cyan-500 uppercase tracking-widest mb-1">Hebrew</p>
          {hebrewCount > 0 ? (
            <div className="flex flex-col gap-0.5 overflow-hidden text-right" dir="rtl">
              {hebrewLines.slice(0, hebrewCount).map((line, i) => (
                <p key={i} className="text-gray-200 text-xs sm:text-sm leading-snug truncate">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-xs italic">No lines revealed</p>
          )}
        </div>
      </div>

      {/* Guess inputs */}
      {!revealed && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 uppercase tracking-widest">Song</label>
            <input
              value={guessTitle}
              onChange={e => setGuessTitle(e.target.value)}
              placeholder="Title..."
              className="bg-gray-800 text-white rounded-xl px-2 sm:px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 uppercase tracking-widest">Artist</label>
            <input
              value={guessArtist}
              onChange={e => setGuessArtist(e.target.value)}
              placeholder="Artist..."
              className="bg-gray-800 text-white rounded-xl px-2 sm:px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 uppercase tracking-widest">Year</label>
            <input
              value={guessYear}
              onChange={e => setGuessYear(e.target.value)}
              placeholder="1985"
              maxLength={4}
              className="bg-gray-800 text-white rounded-xl px-2 sm:px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={togglePlay}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-600/40"
          >
            {isPlaying ? <StopIcon /> : <PlayIcon />}
          </button>
          {revealed && (
            <button
              onClick={() => { setElapsed(0); playerRef.current?.playFromStart() }}
              title="Play from start"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-all"
            >
              <RestartIcon />
            </button>
          )}
        </div>

        {!revealed ? (
          <button
            onClick={() => {
              setResults({
                title: isCloseMatch(guessTitle, song.song_title),
                artist: isCloseMatch(guessArtist, song.artist_name),
                year: isYearMatch(guessYear, song.publish_year),
              })
              onDone()
            }}
            className="bg-purple-700 hover:bg-purple-600 text-white font-semibold px-5 sm:px-8 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg transition shadow-lg shadow-purple-700/30"
          >
            Reveal Answer 🔍
          </button>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 flex flex-col gap-2 flex-1">
            <ResultRow label="Song" guess={guessTitle} answer={song.song_title} correct={results?.title} />
            <ResultRow label="Artist" guess={guessArtist} answer={song.artist_name} correct={results?.artist} />
            <ResultRow label="Year" guess={guessYear} answer={song.publish_year} correct={results?.year} />
          </div>
        )}
      </div>

      {revealed && (
        <button
          onClick={onNext}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg transition border border-gray-700"
        >
          Next Song →
        </button>
      )}
    </div>
  )
}

function ResultRow({ label, guess, answer, correct }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 w-10 sm:w-12 flex-shrink-0 text-xs sm:text-sm">{label}</span>
      <span className={`font-semibold ${correct ? 'text-green-400' : 'text-red-400'}`}>
        {correct ? '✓' : '✗'}
      </span>
      {!correct && guess && (
        <span className="text-gray-500 line-through truncate max-w-[80px] sm:max-w-[100px] text-xs sm:text-sm">{guess}</span>
      )}
      <span className="text-white font-medium truncate text-xs sm:text-sm">{answer}</span>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 sm:w-6 sm:h-6">
      <path d="M6 6h12v12H6z" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 sm:w-6 sm:h-6">
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
    </svg>
  )
}
