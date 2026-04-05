import { useRef, useEffect, useState } from 'react'
import { getVideoId } from '../../utils/youtube'
import YouTubePlayer from '../YouTubePlayer'
import ChallengePanel from './ChallengePanel'

const LINE_PENALTY = { 1: 0, 2: 4, 3: 8 }
const DURATION_PENALTY = { 3: 1, 6: 4, 9: 8 }

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

export default function SpectatorView({ room, myPlayerId, onLeave, onChallenge, onChallengeSubmit, onSkipChallenge, serverTimeOffset = 0, audioUnlocked, onAudioUnlock }) {
  const playerRef = useRef(null)
  const lastAudioId = useRef(null)
  const prevHebrewCount = useRef(0)
  const prevEnglishCount = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [challengeWindowOpen, setChallengeWindowOpen] = useState(false)
  const [challengeCountdown, setChallengeCountdown] = useState(5)

  const timeLimit = room.config?.maxTurnTime || null
  const startedAt = room.turnStartedAt || null
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!timeLimit || !startedAt) return null
    return Math.max(0, timeLimit - Math.floor((Date.now() - startedAt) / 1000))
  })

  useEffect(() => {
    if (!timeLimit || !startedAt) { setTimeLeft(null); return }
    setTimeLeft(Math.max(0, timeLimit - Math.floor((Date.now() - startedAt) / 1000)))
  }, [timeLimit, startedAt])

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || room.revealed) return
    const id = setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, room.revealed])

  const song = room.currentSong
  const hints = room.hints || {}
  const results = room.results
  const revealed = room.revealed

  const activePlayerId = room.playerOrder?.[room.turnIndex]
  const activePlayerName = room.players?.[activePlayerId]?.name || '...'

  const hebrewLines = [song?.hebrew_line_1, song?.hebrew_line_2, song?.hebrew_line_3].filter(Boolean)
  const englishLines = [song?.english_line_1, song?.english_line_2, song?.english_line_3].filter(Boolean)

  // Sync audio from active player's events
  useEffect(() => {
    const ev = hints.audioEvent
    if (!ev || ev.id === lastAudioId.current) return
    lastAudioId.current = ev.id
    if (ev.type === 'snippet') playerRef.current?.playForSeconds(ev.seconds)
    else if (ev.type === 'full') playerRef.current?.play()
    else if (ev.type === 'pause') playerRef.current?.pause()
    else if (ev.type === 'restart') playerRef.current?.playFromStart()
  }, [hints.audioEvent?.id])

  // TTS for Hebrew line hints
  useEffect(() => {
    const count = hints.hebrewCount || 0
    if (count > prevHebrewCount.current && count > 0) {
      speak(hebrewLines.slice(0, count).join('. '), 'he-IL')
    }
    prevHebrewCount.current = count
  }, [hints.hebrewCount])

  // TTS for English line hints
  useEffect(() => {
    const count = hints.englishCount || 0
    if (count > prevEnglishCount.current && count > 0) {
      speak(englishLines.slice(0, count).join('. '), 'en-US')
    }
    prevEnglishCount.current = count
  }, [hints.englishCount])

  // Challenge countdown window (10s after reveal)
  useEffect(() => {
    const revealedAt = room.revealedAt
    if (!revealedAt || room.challenge || room.status !== 'revealed' || room.config?.challengeEnabled === false) {
      setChallengeWindowOpen(false)
      return
    }
    const tick = () => {
      const ms = 10000 - ((Date.now() + serverTimeOffset) - revealedAt)
      if (ms <= 0) { setChallengeWindowOpen(false); return }
      setChallengeWindowOpen(true)
      setChallengeCountdown(Math.ceil(ms / 1000))
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [room.revealedAt, !!room.challenge, room.status, serverTimeOffset])

  if (!song) return (
    <div className="min-h-screen bg-[#0d0d1f] flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">ממתין לשיר...</p>
    </div>
  )

  const videoId = getVideoId(song.youtube_url)
  const paidClues = hints.paidClues || {}

  return (
    <div className="min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6">
      <YouTubePlayer ref={playerRef} videoId={videoId} onPlayStateChange={setIsPlaying} />

      {!audioUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <button
            onClick={() => {
              playerRef.current?.play()
              setTimeout(() => playerRef.current?.pause(), 300)
              onAudioUnlock()
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-10 py-6 rounded-3xl text-2xl shadow-2xl active:scale-95 transition"
            style={{ animation: 'popIn 0.4s ease-out' }}>
            🔊 הפעל שמע
          </button>
        </div>
      )}

      <div className="w-full max-w-3xl flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="bg-gray-800 rounded-2xl px-4 py-2 text-center min-w-[72px]">
            <p className="text-xs text-gray-500 uppercase tracking-widest">סיבוב</p>
            <p className="text-xl font-bold text-white">{room.cyclesDone + 1}</p>
          </div>
          <div className="text-center flex flex-col items-center gap-1">
            <h2 className="text-xl font-bold text-white">תורו של</h2>
            <p className="text-indigo-400 font-bold">{activePlayerName}</p>
            {timeLeft !== null && !room.revealed && (
              <span className={`font-mono font-bold text-sm ${
                timeLeft <= 10 ? 'text-red-400 animate-pulse' : timeLeft <= 30 ? 'text-yellow-400' : 'text-gray-400'
              }`}>
                ⏱ {formatTime(timeLeft)}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="bg-gray-800 rounded-2xl px-4 py-2 text-center min-w-[72px]">
              <p className="text-xs text-gray-500 uppercase tracking-widest">קנסות</p>
              <p className="text-xl font-bold text-red-400">-{hints.penalties || 0}</p>
            </div>
            {onLeave && (
              <button onClick={onLeave} className="text-gray-600 hover:text-gray-400 text-xs transition">
                עזוב ←
              </button>
            )}
          </div>
        </div>

        {/* 3-column hint grid — display only */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">אנגלית</p>
            {englishLines.map((_, i) => {
              const n = i + 1
              const active = (hints.englishCount || 0) >= n
              return (
                <div key={n} className={`w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl text-center relative ${
                  active ? 'bg-cyan-500 text-white' : 'bg-cyan-900/50 text-gray-500'
                }`}>
                  שורה {n}
                  {!paidClues[`en-${n}`] && LINE_PENALTY[n] > 0 && (
                    <span className="absolute top-1 right-2 text-xs text-cyan-300/40">-{LINE_PENALTY[n]}</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">עברית</p>
            {hebrewLines.map((_, i) => {
              const n = i + 1
              const active = (hints.hebrewCount || 0) >= n
              return (
                <div key={n} className={`w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl text-center relative ${
                  active ? 'bg-violet-500 text-white' : 'bg-violet-900/50 text-gray-500'
                }`}>
                  שורה {n}
                  {!paidClues[`he-${n}`] && LINE_PENALTY[n] > 0 && (
                    <span className="absolute top-1 right-2 text-xs text-violet-300/40">-{LINE_PENALTY[n]}</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-center text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">שיר</p>
            {[3, 6, 9].map(s => {
              const active = (hints.songSeconds || 0) >= s || hints.fullPlay
              return (
                <div key={s} className={`w-full py-3 sm:py-5 rounded-2xl font-bold text-base sm:text-xl text-center relative ${
                  active ? 'bg-green-600 text-white' : 'bg-green-900/50 text-gray-500'
                }`}>
                  <span className="flex items-center justify-center gap-1">
                    <span>שניות</span>
                    <span dir="ltr">{s}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Lyric panel */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800/60 rounded-2xl px-3 py-2 border border-cyan-900/40 flex flex-col justify-center min-h-[4rem]">
            <p className="text-xs text-cyan-500 uppercase tracking-widest mb-1">אנגלית</p>
            {(hints.englishCount || 0) > 0 ? (
              <div className="flex flex-col gap-0.5">
                {englishLines.slice(0, hints.englishCount).map((line, i) => (
                  <p key={i} className="text-gray-200 text-xs sm:text-sm leading-snug break-words">{line}</p>
                ))}
              </div>
            ) : <p className="text-gray-600 text-xs italic">לא נחשף</p>}
          </div>
          <div className="bg-gray-800/60 rounded-2xl px-3 py-2 border border-violet-900/40 flex flex-col justify-center min-h-[4rem]">
            <p className="text-xs text-violet-400 uppercase tracking-widest mb-1 text-right">עברית</p>
            {(hints.hebrewCount || 0) > 0 ? (
              <div className="flex flex-col gap-0.5 text-right" dir="rtl">
                {hebrewLines.slice(0, hints.hebrewCount).map((line, i) => (
                  <p key={i} className="text-gray-200 text-xs sm:text-sm leading-snug break-words">{line}</p>
                ))}
              </div>
            ) : <p className="text-gray-600 text-xs italic text-right">לא נחשף</p>}
          </div>
        </div>

        {/* Active player's guesses — visible during challenge window so spectators can decide */}
        {challengeWindowOpen && results && (
          <div className="bg-gray-900/80 border border-gray-700 rounded-2xl px-3 py-2 flex flex-col gap-1" dir="rtl"
            style={{ animation: 'popIn 0.3s ease-out' }}>
            <p className="text-gray-500 text-xs uppercase tracking-widest text-center mb-1">מה {activePlayerName} ניחש</p>
            {[
              { label: 'שיר', guess: results.guessTitle },
              { label: 'אמן', guess: results.guessArtist },
            ].map(({ label, guess }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-6 flex-shrink-0 text-right text-xs">{label}</span>
                <span className="text-white truncate">{guess || '—'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Challenge panel — visible to non-active players during window or while pending/answered */}
        {(challengeWindowOpen || room.challenge) && (
          <ChallengePanel
            challenge={room.challenge || null}
            myPlayerId={myPlayerId}
            windowOpen={challengeWindowOpen}
            countdown={challengeCountdown}
            hasChallengeable={!!results}
            onChallenge={onChallenge}
            onChallengeSubmit={onChallengeSubmit}
            onSkip={onSkipChallenge}
            hasVotedSkip={!!room.skipVotes?.[myPlayerId]}
            roundScore={results?.roundScore}
            activePlayerName={activePlayerName}
          />
        )}

        {/* Revealed results — hidden during active challenge window or pending challenge */}
        {revealed && results && !challengeWindowOpen && room.challenge?.status !== 'pending' ? (
          <div className="bg-gray-900 border border-indigo-700/50 rounded-2xl overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <p className="text-gray-400 text-xs uppercase tracking-widest">תוצאה</p>
              <span className={`font-black text-xl ${results.roundScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {results.roundScore >= 0 ? '+' : ''}{results.roundScore}
              </span>
            </div>
            <div className="flex flex-col gap-2 px-3 pb-2">
              {[
                { label: 'שיר', guess: results.guessTitle, answer: song.song_title, correct: results.title, points: results.title ? '+10' : '0' },
                { label: 'אמן', guess: results.guessArtist, answer: [song.artist_name_1, song.artist_name_2, song.artist_name_3].filter(Boolean).join(' ו'), correct: results.artist, partial: results.artistPartial, points: results.artist ? '+6' : results.artistPartial ? '+3' : '0' },
                { label: 'שנה', guess: results.guessYear, answer: song.publish_year, correct: results.yearGuessed && results.yearPoints > 0, points: results.yearPoints >= 0 ? `+${results.yearPoints}` : `${results.yearPoints}` },
              ].map(({ label, guess, answer, correct, partial, points }) => {
                const ptColor = points?.startsWith('+') && points !== '+0' ? (partial ? 'text-amber-400' : 'text-green-400') : points === '0' || points === '+0' ? 'text-gray-500' : 'text-red-400'
                return (
                  <div key={label} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 text-xs">
                      <span className={`font-bold flex-shrink-0 w-5 text-center ${correct ? 'text-green-400' : partial ? 'text-amber-400' : 'text-red-400'}`}>
                        {correct ? '✓' : partial ? '~✓' : '✗'}
                      </span>
                      <span className="text-gray-400 w-6 flex-shrink-0 text-right">{label}</span>
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
            <div className="border-t border-gray-700 px-3 py-2">
              <button
                onClick={() => isPlaying ? playerRef.current?.pause() : playerRef.current?.play()}
                className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition shadow-lg shadow-red-600/40">
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M6 6h12v12H6z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
            </div>
          </div>
        ) : !revealed && !challengeWindowOpen && !room.challenge ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm animate-pulse">ממתין ל-{activePlayerName} שיחשוף...</p>
          </div>
        ) : null}

      </div>
    </div>
  )
}
