import HelpButton from './HelpButton'

export default function LobbyPage({ players, currentPlayerIdx, gameMode, cyclesDone, onReady, waitingFor }) {
  const sorted = players
    .map((p, i) => ({ ...p, origIdx: i }))
    .sort((a, b) => b.score - a.score)

  const currentPlayer = players[currentPlayerIdx]

  if (!currentPlayer || !gameMode) return null

  const progressText = gameMode.type === 'rounds'
    ? `סיבוב ${cyclesDone + 1} מתוך ${gameMode.value}`
    : `יעד: ${gameMode.value} ניקוד`

  return (
    <div className="min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">לוח תוצאות</h1>
          <p className="text-indigo-400 text-sm mt-1">{progressText}</p>
        </div>

        {/* Scoreboard */}
        <div className="flex flex-col gap-2">
          {sorted.map((p, rank) => {
            const isCurrent = p.origIdx === currentPlayerIdx
            return (
              <div
                key={p.origIdx}
                dir="rtl"
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-2xl transition-all ${
                  isCurrent
                    ? 'bg-indigo-600/30 border-2 border-indigo-500'
                    : 'bg-gray-800 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                  <span className="text-lg w-6 text-center flex-shrink-0">
                    {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`}
                  </span>
                  <span className={`font-bold truncate ${isCurrent ? 'text-white' : 'text-gray-200'}`}>{p.name}</span>
                  {isCurrent && (
                    <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full flex-shrink-0">תורו</span>
                  )}
                </div>
                <span className={`font-black text-xl flex-shrink-0 ${p.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.score}
                </span>
              </div>
            )
          })}
        </div>

        {/* Current player callout */}
        <div className="bg-gray-900 border border-indigo-800/50 rounded-3xl p-6 text-center">
          <p className="text-gray-400 text-sm mb-1">תורו של</p>
          <p className="text-3xl font-black text-white">{currentPlayer.name}</p>
        </div>

        {onReady ? (
          <button
            onClick={onReady}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-2xl transition shadow-lg shadow-indigo-600/30"
          >
            מוכן! 🎵
          </button>
        ) : (
          <div className="text-center py-4 text-gray-400 text-lg animate-pulse">
            ממתין ל-{waitingFor}...
          </div>
        )}

      </div>
      <HelpButton />
    </div>
  )
}
