import { useState, useEffect, useRef } from 'react'
import { getVideoId } from '../utils/youtube'
import { isCloseMatch, yearScore } from '../utils/fuzzy'
import YouTubePlayer from './YouTubePlayer'
import HelpModal from './HelpModal'

const DURATION_PENALTY = { 3: 1, 6: 4, 9: 8 }
const LINE_PENALTY = { 1: 1, 2: 4, 3: 8 }
const FULL_PLAY_PENALTY = 12

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m} : ${String(s).padStart(2, '0')}`
}

function formatArtists(names) {
  if (names.length <= 1) return names[0] || ''
  if (names.length === 2) return `${names[0]} ו${names[1]}`
  return `${names[0]}, ${names[1]} ו${names[2]}`
}

function getPermutations(arr) {
  if (arr.length <= 1) return [arr]
  const result = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const perm of getPermutations(rest)) result.push([arr[i], ...perm])
  }
  return result
}

function checkArtistMatch(guess, names) {
  if (!guess || !guess.trim() || names.length === 0) return { points: 0, correct: false, partial: false }
  if (names.length === 1) {
    const match = isCloseMatch(guess, names[0])
    return { points: match ? 6 : 0, correct: match, partial: false }
  }
  // Full match: guess fuzzy-matches any ordering of all artists joined
  const fullMatch = getPermutations(names).some(perm => isCloseMatch(guess, formatArtists(perm)))
  if (fullMatch) return { points: 6, correct: true, partial: false }
  // Partial: at least one individual artist matches
  const anyMatch = names.some(name => isCloseMatch(guess, name))
  if (anyMatch) return { points: 3, correct: false, partial: true }
  return { points: 0, correct: false, partial: false }
}

function speak(text, lang) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  window.speechSynthesis.speak(utterance)
}

export default function SongCard({ song, revealed, onDone, onNext, round, totalScore, playerName, onHintSync, onAudioEvent, timeLimit, startedAt }) {
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
  const [paidClues, setPaidClues] = useState(new Set())
  const [penalties, setPenalties] = useState(0)
  const [roundScore, setRoundScore] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [yearError, setYearError] = useState(false)
  const [freeHintUsed, setFreeHintUsed] = useState(false)

  const onHintSyncRef = useRef(onHintSync)
  const onAudioEventRef = useRef(onAudioEvent)
  useEffect(() => { onHintSyncRef.current = onHintSync }, [onHintSync])
  useEffect(() => { onAudioEventRef.current = onAudioEvent }, [onAudioEvent])

  // Countdown timer
  const autoSubmittedRef = useRef(false)
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!timeLimit || !startedAt) return null
    return Math.max(0, timeLimit - Math.floor((Date.now() - startedAt) / 1000))
  })

  useEffect(() => {
    if (timeLeft === null || revealed) return
    if (timeLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        handleReveal(true)
      }
      return
    }
    const id = setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, revealed])

  // Sync hint state to Firebase (online mode)
  useEffect(() => {
    onHintSyncRef.current?.({
      hebrewCount, englishCount,
      paidClues: [...paidClues],
      penalties, freeHintUsed,
    })
  }, [hebrewCount, englishCount, paidClues, penalties, freeHintUsed])

  const hebrewLines = [song.hebrew_line_1, song.hebrew_line_2, song.hebrew_line_3].filter(Boolean)
  const englishLines = [song.english_line_1, song.english_line_2, song.english_line_3].filter(Boolean)
  const artistNames = [song.artist_name_1, song.artist_name_2, song.artist_name_3].filter(Boolean)
  const artistDisplay = formatArtists(artistNames)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [isPlaying])

  function charge(key, amount) {
    if (revealed) return
    if (paidClues.has(key)) return
    setPaidClues(prev => new Set([...prev, key]))
    if (amount === 1 && !freeHintUsed) {
      setFreeHintUsed(true)
    } else {
      setPenalties(prev => prev + amount)
    }
  }

  function togglePlay() {
    if (isPlaying) {
      onAudioEventRef.current?.({ type: 'pause', id: String(Date.now()) })
      playerRef.current?.pause()
    } else {
      if (!revealed) charge('song-full', FULL_PLAY_PENALTY)
      onAudioEventRef.current?.({ type: 'full', id: String(Date.now()) })
      playerRef.current?.play()
    }
  }

  function playForSeconds(s) {
    setElapsed(0)
    charge(`song-${s}`, DURATION_PENALTY[s])
    onAudioEventRef.current?.({ type: 'snippet', seconds: s, id: String(Date.now()) })
    playerRef.current?.playForSeconds(s)
  }

  function handleEnglishLine(n) {
    const newCount = englishCount === n ? 0 : n
    setEnglishCount(newCount)
    if (newCount > 0) {
      charge(`en-${n}`, LINE_PENALTY[n])
      speak(englishLines.slice(0, newCount).join('. '), 'en-US')
    }
  }

  function handleHebrewLine(n) {
    const newCount = hebrewCount === n ? 0 : n
    setHebrewCount(newCount)
    if (newCount > 0) {
      charge(`he-${n}`, LINE_PENALTY[n])
      speak(hebrewLines.slice(0, newCount).join('. '), 'he-IL')
    }
  }

  function handleReveal(forced = false) {
    if (!forced && !guessYear.trim()) { setYearError(true); return }

    // Normal assignment
    const normalTitle = isCloseMatch(guessTitle, song.song_title)
    const normalArtist = checkArtistMatch(guessArtist, artistNames)
    // Swapped assignment (player wrote artist in title field and vice versa)
    const swappedTitle = isCloseMatch(guessArtist, song.song_title)
    const swappedArtist = checkArtistMatch(guessTitle, artistNames)

    const useSwapped = (swappedTitle ? 10 : 0) + swappedArtist.points > (normalTitle ? 10 : 0) + normalArtist.points
    const titleCorrect = useSwapped ? swappedTitle : normalTitle
    const artistResult = useSwapped ? swappedArtist : normalArtist

    const yrScore = yearScore(guessYear, song.publish_year)
    const bonuses = (titleCorrect ? 10 : 0) + artistResult.points + yrScore
    const score = bonuses - penalties
    const roundResults = { title: titleCorrect, artist: artistResult.correct, artistPartial: artistResult.partial, artistPoints: artistResult.points, yearPoints: yrScore, yearGuessed: !!guessYear.trim(), guessTitle: guessTitle.trim(), guessArtist: guessArtist.trim(), guessYear: guessYear.trim() }
    setResults(roundResults)
    setRoundScore(score)
    onDone(score, roundResults)
  }

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <YouTubePlayer ref={playerRef} videoId={videoId} onPlayStateChange={setIsPlaying} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="bg-gray-800 rounded-2xl px-4 py-2 text-center min-w-[72px]">
          <p className="text-xs text-gray-500 uppercase tracking-widest">סיבוב</p>
          <p className="text-xl font-bold text-white">{round}</p>
        </div>

        <div className="text-center flex-1 mx-2 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white">נחש את השיר</h2>
          {playerName && <p className="text-indigo-400 text-sm mt-0.5 truncate">{playerName}</p>}
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-gray-800 rounded-2xl px-4 py-2 text-center min-w-[72px]">
            <p className="text-xs text-gray-500 uppercase tracking-widest">ניקוד</p>
            <p className={`text-xl font-bold ${totalScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalScore}
            </p>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="w-9 h-9 rounded-full bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-lg flex items-center justify-center transition shadow-lg shadow-indigo-700/40"
            title="איך משחקים?"
          >
            ?
          </button>
        </div>
      </div>

      {/* Timer */}
      <div className="text-center">
        {timeLeft !== null && !revealed ? (
          <>
            <span className={`text-4xl sm:text-5xl font-mono font-bold tracking-wider ${
              timeLeft <= 10 ? 'text-red-400 animate-pulse' : timeLeft <= 30 ? 'text-yellow-400' : 'text-orange-400'
            }`}>
              {formatTime(timeLeft)}
            </span>
            <p className="text-xs text-gray-600 mt-0.5">נותר</p>
          </>
        ) : (
          <span className="text-4xl sm:text-5xl font-mono font-bold text-orange-400 tracking-wider">
            {formatTime(elapsed)}
          </span>
        )}
        <p className="text-sm mt-1 h-5">
          {penalties > 0 ? (
            <span className="flex items-center justify-center gap-1.5">
              <span dir="ltr" className="text-red-400 text-sm font-semibold">-{penalties}</span>
              <span className="text-gray-600 text-xs">|</span>
              <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-md">קנסות</span>
            </span>
          ) : (
            <span className="text-transparent select-none">·</span>
          )}
        </p>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">

        {/* English lines */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">אנגלית</p>
          {englishLines.map((_, i) => {
            const n = i + 1
            const active = englishCount >= n
            const paid = paidClues.has(`en-${n}`)
            return (
              <button
                key={n}
                onClick={() => handleEnglishLine(n)}
                className={`w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl transition-all relative ${
                  active ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-cyan-900 hover:bg-cyan-800 text-white'
                }`}
              >
                שורה {n}
                {!paid && (n === 1
                  ? <span className="absolute top-1 right-2 text-xs text-cyan-300/60">{freeHintUsed ? '-1' : 'חינם'}</span>
                  : <span dir="ltr" className="absolute top-1 right-2 text-xs text-cyan-300/60">-{LINE_PENALTY[n]}</span>
                )}
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
            const paid = paidClues.has(`he-${n}`)
            return (
              <button
                key={n}
                onClick={() => handleHebrewLine(n)}
                className={`w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl transition-all relative ${
                  active ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30' : 'bg-violet-900 hover:bg-violet-800 text-white'
                }`}
              >
                שורה {n}
                {!paid && (n === 1
                  ? <span className="absolute top-1 right-2 text-xs text-violet-300/60">{freeHintUsed ? '-1' : 'חינם'}</span>
                  : <span dir="ltr" className="absolute top-1 right-2 text-xs text-violet-300/60">-{LINE_PENALTY[n]}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Duration buttons */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">שיר</p>
          {[3, 6, 9].map(s => {
            const paid = paidClues.has(`song-${s}`)
            return (
              <button
                key={s}
                onClick={() => playForSeconds(s)}
                className="w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl text-white bg-green-700 hover:bg-green-600 transition-all shadow-lg shadow-green-700/20 relative"
              >
                <span className="flex items-center justify-center gap-1">
                  <span>שניות</span>
                  <span dir="ltr">{s}</span>
                </span>
                {!paid && (s === 3
                  ? <span className="absolute top-1 right-2 text-xs text-green-300/60">{freeHintUsed ? '-1' : 'חינם'}</span>
                  : <span dir="ltr" className="absolute top-1 right-2 text-xs text-green-300/60">-{DURATION_PENALTY[s]}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Lyric panel */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-gray-800/60 rounded-2xl px-3 py-2 border border-cyan-900/40 flex flex-col justify-center min-h-[4rem]">
          <p className="text-xs text-cyan-500 uppercase tracking-widest mb-1">אנגלית</p>
          {englishCount > 0 ? (
            <div className="flex flex-col gap-0.5">
              {englishLines.slice(0, englishCount).map((line, i) => (
                <p key={i} className="text-gray-200 text-xs sm:text-sm leading-snug break-words">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-xs italic">לא נחשף</p>
          )}
        </div>
        <div className="bg-gray-800/60 rounded-2xl px-3 py-2 border border-violet-900/40 flex flex-col justify-center min-h-[4rem]">
          <p className="text-xs text-violet-400 uppercase tracking-widest mb-1 text-right">עברית</p>
          {hebrewCount > 0 ? (
            <div className="flex flex-col gap-0.5 text-right" dir="rtl">
              {hebrewLines.slice(0, hebrewCount).map((line, i) => (
                <p key={i} className="text-gray-200 text-xs sm:text-sm leading-snug break-words">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-xs italic text-right">לא נחשף</p>
          )}
        </div>
      </div>

      {/* Switchable section — inputs before reveal, summary after */}
      <div>
        {!revealed ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 h-full" dir="rtl">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 tracking-widest text-right">אמן</label>
              <input value={guessArtist} onChange={e => setGuessArtist(e.target.value)}
                placeholder="שם האמן..." dir="rtl"
                className="bg-gray-800 text-white rounded-xl px-2 sm:px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500 text-right" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 tracking-widest text-right">שיר</label>
              <input value={guessTitle} onChange={e => setGuessTitle(e.target.value)}
                placeholder="שם השיר..." dir="rtl"
                className="bg-gray-800 text-white rounded-xl px-2 sm:px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-indigo-500 text-right" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={`text-xs tracking-widest text-right ${yearError ? 'text-red-400' : 'text-gray-500'}`}>
                {yearError ? '⚠ חובה!' : 'שנה'}
              </label>
              <input value={guessYear} onChange={e => { setGuessYear(e.target.value); setYearError(false) }}
                placeholder="שנה..." maxLength={4}
                className={`bg-gray-800 text-white rounded-xl px-2 sm:px-3 py-2 text-sm border focus:outline-none focus:border-indigo-500 text-right ${yearError ? 'border-red-500 animate-pulse' : 'border-gray-700'}`} />
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden" dir="rtl">
            {/* Result rows */}
            <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
              {[
                { label: 'שיר', guess: guessTitle, answer: song.song_title, correct: results?.title, points: results?.title ? '+10' : '0' },
                { label: 'אמן', guess: guessArtist, answer: artistDisplay, correct: results?.artist, partial: results?.artistPartial, points: results?.artist ? '+6' : results?.artistPartial ? '+3' : '0' },
                { label: 'שנה', guess: guessYear, answer: song.publish_year, correct: results?.yearGuessed && results?.yearPoints > 0, points: results?.yearPoints >= 0 ? `+${results.yearPoints}` : `${results?.yearPoints}` },
              ].map(({ label, guess, answer, correct, partial, points }) => {
                const ptColor = points?.startsWith('+') && points !== '+0' ? (partial ? 'text-amber-400' : 'text-green-400') : points === '0' || points === '+0' ? 'text-gray-500' : 'text-red-400'
                return (
                  <div key={label} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 text-xs">
                      <span className={`font-bold flex-shrink-0 w-5 text-center ${correct ? 'text-green-400' : partial ? 'text-amber-400' : 'text-red-400'}`}>{correct ? '✓' : partial ? '~✓' : '✗'}</span>
                      <span className="text-gray-400 flex-shrink-0 w-6 text-right">{label}</span>
                      <span className="text-white font-medium flex-1 text-right truncate">{answer}</span>
                      <span dir="ltr" className={`font-bold flex-shrink-0 w-7 text-left ${ptColor}`}>{points}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs pr-5" dir="rtl">
                      <span className="text-gray-600 flex-shrink-0">ניחשת:</span>
                      <span className="text-gray-400 truncate">{guess || '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Footer: play controls + score */}
            <div className="border-t border-gray-700 px-3 py-2 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition shadow-lg shadow-red-600/40">
                  {isPlaying ? <StopIcon /> : <PlayIcon />}
                </button>
                <button onClick={() => { setElapsed(0); onAudioEventRef.current?.({ type: 'restart', id: String(Date.now()) }); playerRef.current?.playFromStart() }}
                  className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition">
                  <RestartIcon />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {penalties > 0 && <span className="text-red-400 text-xs">קנסות -{penalties}</span>}
                <div className="text-right">
                  <span className="text-gray-500 text-xs block">ניקוד הסיבוב</span>
                  <span dir="ltr" className={`text-2xl font-black ${roundScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {roundScore >= 0 ? '+' : ''}{roundScore}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {!revealed ? (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <button onClick={togglePlay}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-600/40">
            {isPlaying ? <StopIcon /> : <PlayIcon />}
          </button>
          <button onClick={handleReveal}
            className="flex-1 bg-purple-700 hover:bg-purple-600 text-white font-semibold py-3 rounded-2xl text-base sm:text-lg transition shadow-lg shadow-purple-700/30">
            הגש ניחוש 🔍
          </button>
        </div>
      ) : onNext ? (
        <button onClick={onNext}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-2xl text-base sm:text-lg transition border border-gray-700">
          → שיר הבא
        </button>
      ) : (
        <div className="w-full bg-orange-950/40 border border-orange-700/50 text-orange-400 font-semibold py-3 rounded-2xl text-base sm:text-lg text-center animate-pulse">
          ⚔️ ממתין לסיום האתגר...
        </div>
      )}
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
