import { useState, useEffect, useRef } from 'react'
import { ref, onValue, off, update, remove, onDisconnect, runTransaction, serverTimestamp } from 'firebase/database'
import { db, EMPTY_HINTS } from '../../firebase'
import { isCloseMatch } from '../../utils/fuzzy'
import SongCard from '../SongCard'
import SpectatorView from './SpectatorView'
import ChallengePanel from './ChallengePanel'
import LobbyPage from '../LobbyPage'
import Confetti from '../Confetti'

const BG = 'min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6'

export default function OnlineGame({ roomId, myPlayerId, songsHe, songsEn, onLeave }) {
  const [room, setRoom] = useState(null)
  const [localRevealed, setLocalRevealed] = useState(false)
  const [localScore, setLocalScore] = useState(0)
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  const [challengeWindowOpen, setChallengeWindowOpen] = useState(false)

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
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [room?.revealedAt, !!room?.challenge, room?.status, serverTimeOffset])

  // On disconnect, remove only this player — disconnect detection handles game state
  useEffect(() => {
    const target = ref(db, `rooms/${roomId}/players/${myPlayerId}`)
    onDisconnect(target).remove()
    return () => onDisconnect(target).cancel()
  }, [])

  async function handleLeave() {
    await remove(ref(db, `rooms/${roomId}/players/${myPlayerId}`))
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

    const currentPlayers = room.players || {}
    const order = room.playerOrder || []
    const remainingIds = order.filter(id => currentPlayers[id])

    // Only 1 (or 0) players left → end game immediately
    if (remainingIds.length < 2) {
      if (remainingIds[0] === myPlayerId) {
        update(ref(db, `rooms/${roomId}`), { status: 'finished' })
      }
      return
    }

    // Active player left mid-turn → first remaining player advances the turn
    const activeId = order[room.turnIndex]
    if (activeId && !currentPlayers[activeId] && remainingIds[0] === myPlayerId) {
      advanceAfterDisconnect(currentPlayers, remainingIds)
    }
  }, [JSON.stringify(Object.keys(room?.players || {}).sort()), room?.status])

  async function advanceAfterDisconnect(currentPlayers, remainingIds) {
    const order = room.playerOrder || []
    // Find next turn index with a connected player
    let next = (room.turnIndex + 1) % order.length
    for (let i = 0; i < order.length; i++) {
      if (currentPlayers[order[next]]) break
      next = (next + 1) % order.length
    }
    const newCycles = next <= room.turnIndex ? room.cyclesDone + 1 : room.cyclesDone
    const newUsedUrls = room.currentSong
      ? [...(room.usedUrls || []), room.currentSong.youtube_url]
      : (room.usedUrls || [])

    if (room.config.gameMode.type === 'rounds' && newCycles >= room.config.gameMode.value) {
      await update(ref(db, `rooms/${roomId}`), { status: 'finished', usedUrls: newUsedUrls })
      return
    }
    if (room.config.gameMode.type === 'score') {
      const maxScore = Math.max(...remainingIds.map(id => currentPlayers[id]?.score || 0))
      if (maxScore >= room.config.gameMode.value) {
        await update(ref(db, `rooms/${roomId}`), { status: 'finished', usedUrls: newUsedUrls })
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
      [`players/${idx}/score`]: prevScore + roundScore,
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
      await update(ref(db, `rooms/${roomId}`), { status: 'finished', usedUrls })
      return
    }
    if (room.config.gameMode.type === 'score') {
      const maxScore = Math.max(...Object.values(latestPlayers).map(p => p.score || 0))
      if (maxScore >= room.config.gameMode.value) {
        await update(ref(db, `rooms/${roomId}`), { status: 'finished', usedUrls })
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
      await update(ref(db, `rooms/${roomId}`), { status: 'finished' })
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

  // Between turns — scoreboard
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

  // Active player's turn
  if (status === 'guessing' || status === 'revealed') {
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
            onDone={handleDone}
            onNext={showReveal ? handleNext : null}
            round={room.cyclesDone + 1}
            totalScore={localScore}
            playerName={players[myPlayerId]?.name}
            onHintSync={handleHintSync}
            onAudioEvent={handleAudioEvent}
            timeLimit={room.config?.maxTurnTime || null}
            startedAt={room.turnStartedAt || null}
          />
          {challengePending && (
            <div className="mt-3 animate-pulse" dir="rtl" style={{ animation: 'popIn 0.3s ease-out' }}>
              <p className="text-orange-400 font-bold text-sm text-center">⚔️ {room.challenge.challengerName} מאתגר...</p>
            </div>
          )}
          {challengeAnswered && showReveal && (
            <div className="mt-3 w-full max-w-md">
              <ChallengePanel challenge={room.challenge} myPlayerId={myPlayerId} windowOpen={false} countdown={0} hasChallengeable={false} onChallenge={null} onChallengeSubmit={null} />
            </div>
          )}
          <button onClick={handleLeave} className="mt-4 text-gray-600 hover:text-gray-400 text-xs transition">
            עזוב משחק ←
          </button>
        </div>
      )
    }
    // Spectator
    return <SpectatorView room={room} myPlayerId={myPlayerId} onLeave={handleLeave} onChallenge={handleChallenge} onChallengeSubmit={handleChallengeSubmit} serverTimeOffset={serverTimeOffset} />
  }

  // End screen
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
      </div>
    )
  }

  return <div className={BG}><p className="text-gray-400 animate-pulse">טוען...</p></div>
}
