import { useState, useEffect, useRef, Component } from 'react'
import { ref, onValue, off, update, remove, onDisconnect, runTransaction, serverTimestamp, set, increment } from 'firebase/database'
import { db, EMPTY_HINTS } from '../../firebase'
import { isCloseMatch } from '../../utils/fuzzy'
import { getVideoId } from '../../utils/youtube'
import SongCard from '../SongCard'
import SpectatorView from './SpectatorView'
import ChallengePanel from './ChallengePanel'
import LobbyPage from '../LobbyPage'
import Confetti from '../Confetti'
import HelpButton from '../HelpButton'
import YouTubePlayer from '../YouTubePlayer'

const BG = 'min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { crashed: false, msg: '' } }
  static getDerivedStateFromError(e) { return { crashed: true, msg: e?.message || String(e) } }
  render() {
    if (this.state.crashed) return (
      <div className={BG} dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-5xl">⚠️</p>
          <p className="text-white font-bold text-xl">משהו השתבש</p>
          <p className="text-gray-500 text-xs font-mono px-4 break-all">{this.state.msg}</p>
          <button onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-2xl text-lg transition">
            רענן דף
          </button>
        </div>
      </div>
    )
    return this.props.children
  }
}

export default function OnlineGame({ roomId, myPlayerId, songsHe, songsEn, onLeave }) {
  const [room, setRoom] = useState(null)
  const [localRevealed, setLocalRevealed] = useState(false)
  const [localScore, setLocalScore] = useState(0)
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  const [challengeWindowOpen, setChallengeWindowOpen] = useState(false)
  const [challengeCountdown, setChallengeCountdown] = useState(10)
  // Spectator audio player — lives in OnlineGame so it persists across turns
  const spectatorPlayerRef = useRef(null)
  const [spectatorVideoId, setSpectatorVideoId] = useState(null)
  const [spectatorPlayerMounted, setSpectatorPlayerMounted] = useState(false)
  const [spectatorIsPlaying, setSpectatorIsPlaying] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`)
    const handler = onValue(roomRef, snap => {
      if (!snap.exists()) { onLeave(); return }
      setRoom(snap.val())
    })
    return () => off(roomRef, 'value', handler)
  }, [roomId])

  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset')
    const handler = onValue(offsetRef, snap => setServerTimeOffset(snap.val() || 0))
    return () => off(offsetRef, 'value', handler)
  }, [])

  // Mirror challenge window tracking for the active player
  useEffect(() => {
    const revealedAt = room?.revealedAt
    if (!revealedAt || room?.challenge || room?.status !== 'revealed' || room?.config?.challengeEnabled === false) {
      setChallengeWindowOpen(false); return
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
  }, [room?.revealedAt, !!room?.challenge, room?.status, serverTimeOffset])

  // Disconnect handling — onDisconnect marks disconnectedAt (never removes directly)
  // visibilitychange runs a 60s grace timer before calling handleLeave()
  useEffect(() => {
    const disconnectedAtRef = ref(db, `rooms/${roomId}/players/${myPlayerId}/disconnectedAt`)
    let leaveTimer = null

    // Mark as connected (clear any stale disconnectedAt)
    set(disconnectedAtRef, null)
    // On actual disconnect: stamp the time (not remove — avoids race on mobile tab switch)
    onDisconnect(disconnectedAtRef).set(serverTimestamp())

    const onVisibilityChange = () => {
      if (document.hidden) {
        leaveTimer = setTimeout(() => { handleLeave() }, 60000)
      } else {
        clearTimeout(leaveTimer)
        leaveTimer = null
        set(disconnectedAtRef, null) // came back — clear the stamp
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearTimeout(leaveTimer)
      // Do NOT cancel onDisconnect here — if the browser closes/refreshes,
      // React cleanup runs and would cancel the handler before the connection drops,
      // preventing disconnectedAt from ever being stamped (zombie rooms).
      // handleLeave() removes the player via transaction, so the stamp is harmless there.
    }
  }, [])

  async function finishGame(extraFields = {}) {
    // Use transaction to ensure only one client increments the counter
    await runTransaction(ref(db, `rooms/${roomId}/counted`), current => {
      if (current) return // already counted — abort
      return true
    }).then(({ committed }) => {
      if (committed) update(ref(db, 'stats'), { gamesPlayed: increment(1) })
    })
    await update(ref(db, `rooms/${roomId}`), { status: 'finished', counted: true, ...extraFields })
  }

  async function handleLeave() {
    await runTransaction(ref(db, `rooms/${roomId}`), current => {
      if (!current) return null
      const players = { ...(current.players || {}) }
      delete players[myPlayerId]
      if (Object.keys(players).length === 0) return null // delete room
      return { ...current, players }
    })
    onLeave()
  }

  // Sync local score from Firebase
  useEffect(() => {
    if (room?.players?.[myPlayerId]) {
      setLocalScore(room.players[myPlayerId].score)
    }
  }, [room?.players?.[myPlayerId]?.score])

  // Handle player disconnects mid-game
  useEffect(() => {
    if (!room || room.status === 'finished' || room.status === 'waiting') return

    const TIMEOUT = 60000
    const now = Date.now() + serverTimeOffset
    const isActive = p => p && (!p.disconnectedAt || now - p.disconnectedAt < TIMEOUT)

    const currentPlayers = room.players || {}
    const order = room.playerOrder || []
    const remainingIds = order.filter(id => isActive(currentPlayers[id]))

    if (remainingIds.length < 2) {
      if (remainingIds[0] === myPlayerId) {
        finishGame()
      }
      return
    }

    const activeId = order[room.turnIndex]
    if (activeId && !isActive(currentPlayers[activeId]) && remainingIds[0] === myPlayerId) {
      advanceAfterDisconnect(currentPlayers, remainingIds, isActive)
    }
  }, [JSON.stringify(Object.entries(room?.players || {}).map(([id, p]) => `${id}:${p?.disconnectedAt||''}`).sort()), room?.status, serverTimeOffset])

  async function advanceAfterDisconnect(currentPlayers, remainingIds, isActive) {
    const order = room.playerOrder || []
    let next = (room.turnIndex + 1) % order.length
    for (let i = 0; i < order.length; i++) {
      if (isActive(currentPlayers[order[next]])) break
      next = (next + 1) % order.length
    }
    const newCycles = next <= room.turnIndex ? room.cyclesDone + 1 : room.cyclesDone
    const newUsedUrls = room.currentSong
      ? [...(room.usedUrls || []), room.currentSong.youtube_url]
      : (room.usedUrls || [])

    if (room.config.gameMode.type === 'rounds' && newCycles >= room.config.gameMode.value) {
      await finishGame({ usedUrls: newUsedUrls })
      return
    }
    if (room.config.gameMode.type === 'score') {
      const maxScore = Math.max(...remainingIds.map(id => currentPlayers[id]?.score || 0))
      if (maxScore >= room.config.gameMode.value) {
        await finishGame({ usedUrls: newUsedUrls })
        return
      }
    }
    await update(ref(db, `rooms/${roomId}`), {
      turnIndex: next,
      cyclesDone: newCycles,
      usedUrls: newUsedUrls,
      revealed: false,
      results: null,
      hints: EMPTY_HINTS,
      status: 'lobby',
      currentSong: null,
      challenge: null,
      revealedAt: null,
    })
  }

  // Reset local revealed when a new turn starts
  useEffect(() => {
    if (room?.status === 'guessing') setLocalRevealed(false)
  }, [room?.status, room?.currentSong?.youtube_url])

  // Track current song videoId for spectator player.
  // Once the player is mounted it NEVER unmounts — the iOS audio context stays
  // unlocked for the whole game. We only update the videoId when spectating.
  useEffect(() => {
    if (!room) return
    const activeId = room.playerOrder?.[room.turnIndex]
    const iAm = activeId === myPlayerId
    if (!iAm && room.currentSong?.youtube_url) {
      const vid = getVideoId(room.currentSong.youtube_url)
      if (vid) {
        setSpectatorVideoId(vid)
        setSpectatorPlayerMounted(true) // once true, never goes back to false
      }
    }
    // When iAm (active turn): keep last videoId, keep player mounted, keep audioUnlocked
  }, [room?.currentSong?.youtube_url, room?.playerOrder?.[room?.turnIndex]])

  // Transparent audio unlock — retries on every touch until the YT player is ready.
  // Using { once: true } caused a race: if the first touch arrived before the player
  // finished loading (readyRef = false), play() silently returned and the listener
  // was gone — audio stayed locked. Now we keep listening until it actually succeeds.
  useEffect(() => {
    if (audioUnlocked || !spectatorPlayerMounted) return
    function unlock() {
      if (!spectatorPlayerRef.current?.isReady()) return // player not ready yet — wait for next touch
      spectatorPlayerRef.current.play()
      setTimeout(() => spectatorPlayerRef.current?.pause(), 300)
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
      }
      setAudioUnlocked(true)
    }
    document.addEventListener('touchstart', unlock, { passive: true })
    document.addEventListener('click', unlock)
    return () => {
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
    }
  }, [audioUnlocked, spectatorPlayerMounted])

  if (!room) return (
    <div className={BG}><p className="text-gray-400 animate-pulse">טוען...</p></div>
  )

  const activePlayerId = room.playerOrder?.[room.turnIndex]
  const isActivePlayer = activePlayerId === myPlayerId
  const activeSongs = room.config?.language === 'en' ? songsEn : songsHe

  const players = room.players || {}
  const playerList = room.playerOrder?.map(id => ({ id, ...players[id], name: players[id]?.name || '?' })) || []

  // ── Callbacks for active player's SongCard ──────────────────────────

  function handleHintSync(hintsState) {
    update(ref(db, `rooms/${roomId}/hints`), {
      hebrewCount: hintsState.hebrewCount,
      englishCount: hintsState.englishCount,
      paidClues: Object.fromEntries([...hintsState.paidClues].map(k => [k, true])),
      penalties: hintsState.penalties,
      freeHintUsed: hintsState.freeHintUsed,
    })
  }

  function handleAudioEvent(event) {
    update(ref(db, `rooms/${roomId}/hints`), {
      audioEvent: event,
      songSeconds: event.type === 'snippet' ? event.seconds : (room.hints?.songSeconds || 0),
      fullPlay: event.type === 'full',
    })
  }

  async function handleDone(roundScore, results) {
    setLocalRevealed(true)
    setLocalScore(s => s + roundScore)
    const idx = activePlayerId
    const prevScore = room.players?.[idx]?.score || 0
    await update(ref(db, `rooms/${roomId}`), {
      revealed: true,
      results: { ...results, roundScore },
      status: 'revealed',
      revealedAt: serverTimestamp(),
      challenge: null,
      skipVotes: null,
      [`players/${idx}/score`]: prevScore + roundScore,
    })
  }

  async function handleSkipVote() {
    await runTransaction(ref(db, `rooms/${roomId}`), current => {
      if (!current || !current.revealedAt) return // window already closed
      const skipVotes = { ...(current.skipVotes || {}), [myPlayerId]: true }
      const activeId = current.playerOrder?.[current.turnIndex]
      const spectatorIds = (current.playerOrder || []).filter(id => id !== activeId)
      const allVoted = spectatorIds.length > 0 && spectatorIds.every(id => skipVotes[id])
      if (allVoted) {
        return { ...current, revealedAt: null, skipVotes: null }
      }
      return { ...current, skipVotes }
    })
  }

  async function handleChallenge() {
    const myName = players[myPlayerId]?.name || '?'
    await runTransaction(ref(db, `rooms/${roomId}/challenge`), current => {
      if (current !== null) return // already claimed — abort
      return { challengerId: myPlayerId, challengerName: myName, status: 'pending' }
    })
  }

  async function handleChallengeSubmit(guessTitle, guessArtist) {
    const results = room.results || {}
    const song = room.currentSong || {}
    const names = [song.artist_name_1, song.artist_name_2, song.artist_name_3].filter(Boolean)
    const titleAnswer = song.song_title || ''
    const artistAnswer = names.join(' ו')

    function matchArtist(g) {
      if (!g?.trim() || names.length === 0) return { correct: false, partial: false, points: 0 }
      if (names.some(n => isCloseMatch(g, n))) return { correct: true, partial: false, points: 6 }
      const partial = names.some(n => n.toLowerCase().split(/\s+/).some(w => g.toLowerCase().split(/\s+/).includes(w)))
      return { correct: false, partial, points: partial ? 3 : 0 }
    }

    const titleChallengeable = !results.title
    const artistChallengeable = !results.artist && !results.artistPartial
    const artistPettyCase = results.artistPartial && !results.artist

    let titleChecked = false, titleCorrect = false, titlePoints = 0
    let artistChecked = false, artistCorrect = false, artistPartial = false, artistPoints = 0
    let petty = false

    if (titleChallengeable || artistChallengeable) {
      // Try both normal and swapped assignments, take the better total
      const normalTitleOk = titleChallengeable ? isCloseMatch(guessTitle, song.song_title) : false
      const normalArtist = artistChallengeable ? matchArtist(guessArtist) : { correct: false, partial: false, points: 0 }
      const swapTitleOk = titleChallengeable ? isCloseMatch(guessArtist, song.song_title) : false
      const swapArtist = artistChallengeable ? matchArtist(guessTitle) : { correct: false, partial: false, points: 0 }

      const normalTotal = (normalTitleOk ? 10 : 0) + normalArtist.points
      const swapTotal = (swapTitleOk ? 10 : 0) + swapArtist.points
      const useSwap = swapTotal > normalTotal

      if (titleChallengeable) {
        titleChecked = true
        titleCorrect = useSwap ? swapTitleOk : normalTitleOk
        titlePoints = titleCorrect ? 10 : 0
      }
      if (artistChallengeable) {
        artistChecked = true
        const ar = useSwap ? swapArtist : normalArtist
        artistCorrect = ar.correct; artistPartial = ar.partial; artistPoints = ar.points
      }
    }

    if (artistPettyCase) {
      // Active had ~✓ — challenger gets no points but we record the attempt
      artistChecked = true
      const ar1 = matchArtist(guessArtist)
      const ar2 = matchArtist(guessTitle)
      const best = ar1.points >= ar2.points ? ar1 : ar2
      artistCorrect = best.correct; artistPartial = best.partial
      petty = !artistCorrect
      artistPoints = 0
    }

    const net = titlePoints + artistPoints - 5

    const challengerId = room.challenge?.challengerId
    const prevScore = room.players?.[challengerId]?.score || 0
    await update(ref(db, `rooms/${roomId}`), {
      [`players/${challengerId}/score`]: prevScore + net,
      challenge: {
        ...room.challenge,
        status: 'answered',
        guessTitle: guessTitle.trim(),
        guessArtist: guessArtist.trim(),
        result: { titleChecked, titleCorrect, titlePoints, titleAnswer, artistChecked, artistCorrect, artistPartial, artistPoints, artistAnswer, net, petty },
      },
    })
  }

  async function handleNext() {
    if (room.challenge?.status === 'pending') return
    const usedUrls = [...(room.usedUrls || []), room.currentSong.youtube_url]
    const nextTurn = (room.turnIndex + 1) % room.playerOrder.length
    const newCycles = nextTurn === 0 ? room.cyclesDone + 1 : room.cyclesDone

    // Check end condition
    const latestPlayers = room.players || {}
    if (room.config.gameMode.type === 'rounds' && newCycles >= room.config.gameMode.value) {
      await finishGame({ usedUrls })
      return
    }
    if (room.config.gameMode.type === 'score') {
      const maxScore = Math.max(...Object.values(latestPlayers).map(p => p.score || 0))
      if (maxScore >= room.config.gameMode.value) {
        await finishGame({ usedUrls })
        return
      }
    }

    await update(ref(db, `rooms/${roomId}`), {
      turnIndex: nextTurn,
      cyclesDone: newCycles,
      usedUrls,
      revealed: false,
      results: null,
      hints: EMPTY_HINTS,
      status: 'lobby',
      currentSong: null,
      challenge: null,
      revealedAt: null,
      skipVotes: null,
    })
  }

  async function handleReady() {
    const usedUrlsSet = new Set(room.usedUrls || [])
    const yearRange = room.config?.yearRange || null
    const available = activeSongs.filter(s => {
      if (usedUrlsSet.has(s.youtube_url)) return false
      if (yearRange) {
        const y = parseInt(s.publish_year, 10)
        if (isNaN(y) || y < yearRange.min || y > yearRange.max) return false
      }
      return true
    })
    if (available.length === 0) {
      await finishGame()
      return
    }
    const song = available[Math.floor(Math.random() * available.length)]
    await update(ref(db, `rooms/${roomId}`), {
      currentSong: song,
      status: 'guessing',
      hints: EMPTY_HINTS,
      revealed: false,
      results: null,
      turnStartedAt: Date.now(),
    })
  }

  // ── Render based on status ───────────────────────────────────────────

  const status = room.status

  function renderContent() {
    if (status === 'lobby') {
      return (
        <LobbyPage
          players={playerList}
          currentPlayerIdx={room.playerOrder?.indexOf(activePlayerId)}
          gameMode={room.config?.gameMode}
          cyclesDone={room.cyclesDone || 0}
          onReady={isActivePlayer ? handleReady : null}
          waitingFor={!isActivePlayer ? playerList.find(p => p.id === activePlayerId)?.name : null}
        />
      )
    }

    if (status === 'guessing' || status === 'revealed') {
      if (!room.currentSong) return (
        <div className={BG}><p className="text-gray-400 animate-pulse">טוען שיר...</p></div>
      )
      if (isActivePlayer) {
        const challengePending = room.challenge?.status === 'pending'
        const challengeAnswered = room.challenge?.status === 'answered'
        const waitingForChallenge = localRevealed && (challengeWindowOpen || challengePending)
        const showReveal = localRevealed && !waitingForChallenge
        return (
          <div className={BG}>
            <SongCard
              key={room.currentSong?.youtube_url}
              song={room.currentSong}
              revealed={showReveal}
              submittedPending={waitingForChallenge}
              challengeCountdown={challengeWindowOpen && !challengePending ? challengeCountdown : null}
              onDone={handleDone}
              onNext={showReveal ? handleNext : null}
              round={room.cyclesDone + 1}
              totalScore={localScore}
              playerName={players[myPlayerId]?.name}
              onHintSync={handleHintSync}
              onAudioEvent={handleAudioEvent}
              timeLimit={room.config?.maxTurnTime || null}
              startedAt={room.turnStartedAt || null}
              language={room.config?.language || 'he'}
            />
            {challengePending && (
              <div className="mt-3 animate-pulse" dir="rtl" style={{ animation: 'popIn 0.3s ease-out' }}>
                <p className="text-orange-400 font-bold text-sm text-center">⚔️ {room.challenge.challengerName} מאתגר...</p>
              </div>
            )}
            {challengeAnswered && showReveal && (
              <div className="mt-3 w-full max-w-md">
                <ChallengePanel challenge={room.challenge} myPlayerId={myPlayerId} windowOpen={false} countdown={0} hasChallengeable={false} onChallenge={null} onChallengeSubmit={null}
                  roundScore={room.results?.roundScore} activePlayerName={players[myPlayerId]?.name} />
              </div>
            )}
            <button onClick={handleLeave} className="mt-4 text-gray-600 hover:text-gray-400 text-xs transition">
              עזוב משחק ←
            </button>
            <HelpButton />
          </div>
        )
      }
      return (
        <SpectatorView
          room={room} myPlayerId={myPlayerId} onLeave={handleLeave}
          onChallenge={handleChallenge} onChallengeSubmit={handleChallengeSubmit}
          onSkipChallenge={handleSkipVote} serverTimeOffset={serverTimeOffset}
          playerRef={spectatorPlayerRef} isPlaying={spectatorIsPlaying}
        />
      )
    }

    if (status === 'finished') {
      const sorted = Object.entries(room.players || {})
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
      const winner = sorted[0]
      return (
        <div className={BG}>
          <Confetti />
          <div className="flex flex-col items-center gap-5 text-center w-full max-w-md relative z-10">
            <p className="text-7xl" style={{ animation: 'popIn 0.6s ease-out forwards' }}>🏆</p>
            <h1 className="text-4xl font-bold text-white" style={{ animation: 'popIn 0.6s 0.15s ease-out both' }}>
              המשחק נגמר!
            </h1>
            {sorted.length > 1 && (
              <p className="text-3xl text-yellow-400 font-black" style={{ animation: 'popIn 0.7s 0.3s ease-out both' }}>
                🎉 {winner.name} ניצח! 🎉
              </p>
            )}
            <div className="w-full flex flex-col gap-2">
              {sorted.map((p, i) => (
                <div key={p.id} dir="rtl"
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl ${
                    i === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800 border border-transparent'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span className="text-white font-bold">{p.name}</span>
                    {p.id === myPlayerId && <span className="text-xs text-gray-500">(אתה)</span>}
                  </div>
                  <span className={`font-black text-xl ${(p.score || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.score || 0}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={handleLeave}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-10 py-4 rounded-2xl text-xl transition">
              חזור לתפריט
            </button>
          </div>
          <HelpButton />
        </div>
      )
    }

    return null
  }

  return (
    <ErrorBoundary>
      {/* Spectator audio player — mounts on first spectator turn and NEVER unmounts.
          Keeping the same iframe alive across turns preserves the iOS audio unlock. */}
      {spectatorPlayerMounted && (
        <YouTubePlayer
          key="spectator-player"
          ref={spectatorPlayerRef}
          videoId={spectatorVideoId}
          onPlayStateChange={setSpectatorIsPlaying}
        />
      )}
      {renderContent()}
    </ErrorBoundary>
  )
}
