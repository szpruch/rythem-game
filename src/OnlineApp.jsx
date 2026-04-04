import { useState } from 'react'
import OnlineLobby from './components/online/OnlineLobby'
import WaitingRoom from './components/online/WaitingRoom'
import OnlineGame from './components/online/OnlineGame'

export default function OnlineApp({ songsHe, songsEn, csvYearsHe, csvYearsEn, onBack }) {
  const [phase, setPhase] = useState('lobby') // 'lobby' | 'waiting' | 'game'
  const [roomId, setRoomId] = useState(null)
  const [myPlayerId, setMyPlayerId] = useState(null)

  function handleJoin(roomId, playerId) {
    setRoomId(roomId)
    setMyPlayerId(playerId)
    setPhase('waiting')
  }

  function handleGameStart() {
    setPhase('game')
  }

  function handleLeave() {
    setRoomId(null)
    setMyPlayerId(null)
    setPhase('lobby')
  }

  if (phase === 'lobby') {
    return (
      <OnlineLobby
        songsHe={songsHe}
        songsEn={songsEn}
        csvYearsHe={csvYearsHe}
        csvYearsEn={csvYearsEn}
        onJoin={handleJoin}
        onBack={onBack}
      />
    )
  }

  if (phase === 'waiting') {
    return (
      <WaitingRoom
        roomId={roomId}
        myPlayerId={myPlayerId}
        onGameStart={handleGameStart}
        onLeave={handleLeave}
      />
    )
  }

  return (
    <OnlineGame
      roomId={roomId}
      myPlayerId={myPlayerId}
      songsHe={songsHe}
      songsEn={songsEn}
      onLeave={handleLeave}
    />
  )
}
