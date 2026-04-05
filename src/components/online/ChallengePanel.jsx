import { useState } from 'react'

export default function ChallengePanel({
  challenge, myPlayerId, windowOpen, countdown,
  hasChallengeable, onChallenge, onChallengeSubmit,
}) {
  const [guessTitle, setGuessTitle] = useState('')
  const [guessArtist, setGuessArtist] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    await onChallengeSubmit(guessTitle, guessArtist)
  }

  // ── 1. Challenge window: countdown + button ─────────────────────────
  if (windowOpen && !challenge) {
    if (!hasChallengeable) return null
    const clr = countdown <= 3 ? 'text-red-400' : countdown <= 6 ? 'text-yellow-400' : 'text-green-400'
    return (
      <div className="flex flex-col items-center gap-3">
        <div className={`text-7xl font-black tabular-nums ${clr} ${countdown <= 3 ? 'animate-pulse' : ''}`}>
          {countdown}
        </div>
        <button onClick={onChallenge}
          className="w-full bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-black py-4 rounded-2xl text-xl transition shadow-lg shadow-orange-600/40"
          style={{ animation: 'popIn 0.3s ease-out' }}>
          ⚔️ אתגר!
        </button>
        <p className="text-gray-600 text-xs">עלות: -5 נקודות · רק אחד יכול לאתגר</p>
      </div>
    )
  }

  // ── 2. I'm the challenger: input form ───────────────────────────────
  if (challenge?.challengerId === myPlayerId && challenge?.status === 'pending') {
    return (
      <div className="bg-orange-950/40 border border-orange-600/50 rounded-2xl p-4 flex flex-col gap-3"
        dir="rtl" style={{ animation: 'popIn 0.3s ease-out' }}>
        <p className="text-orange-400 font-black text-center text-lg">⚔️ אתה מאתגר!</p>
        <p className="text-gray-400 text-xs text-center">-5 נקודות · תרוויח רק על מה שהשחקן פספס</p>
        <input value={guessTitle} onChange={e => setGuessTitle(e.target.value)}
          placeholder="שם השיר..." dir="rtl"
          className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-orange-800/50 focus:outline-none focus:border-orange-500 text-right" />
        <input value={guessArtist} onChange={e => setGuessArtist(e.target.value)}
          placeholder="שם האמן..." dir="rtl"
          className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-orange-800/50 focus:outline-none focus:border-orange-500 text-right" />
        <button onClick={submit} disabled={submitting}
          className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50">
          {submitting ? 'שולח...' : 'שלח ⚔️'}
        </button>
      </div>
    )
  }

  // ── 3. Someone else is challenging ──────────────────────────────────
  if (challenge?.status === 'pending') {
    return (
      <div className="bg-orange-950/40 border border-orange-600/50 rounded-2xl p-5 text-center"
        style={{ animation: 'popIn 0.4s ease-out' }}>
        <div className="text-4xl mb-2" style={{ display: 'inline-block', animation: 'bounce 1s ease-in-out infinite' }}>⚔️</div>
        <p className="text-orange-400 font-black text-xl">{challenge.challengerName}</p>
        <p className="text-gray-400 text-sm mt-1 animate-pulse">מאתגר את התשובה...</p>
      </div>
    )
  }

  // ── 4. Challenge answered: results ──────────────────────────────────
  if (challenge?.status === 'answered') {
    const r = challenge.result || {}
    return (
      <div className="bg-orange-950/30 border border-orange-700/50 rounded-2xl p-3 flex flex-col gap-2"
        dir="rtl" style={{ animation: 'popIn 0.3s ease-out' }}>
        <p className="text-orange-400 font-bold text-xs uppercase tracking-widest text-center">
          ⚔️ תוצאת המאתגר — {challenge.challengerName}
        </p>
        {r.petty && (
          <p className="text-yellow-400 font-black text-center text-base py-1 animate-bounce">
            😏 אל תהיה קטנוני!
          </p>
        )}
        {r.titleChecked && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs">
              <span className={`font-bold w-5 text-center ${r.titleCorrect ? 'text-green-400' : 'text-red-400'}`}>{r.titleCorrect ? '✓' : '✗'}</span>
              <span className="text-gray-400 w-6">שיר</span>
              <span className="text-white font-medium flex-1 text-right truncate">{r.titleAnswer}</span>
              <span dir="ltr" className={`font-bold w-8 text-left ${r.titlePoints > 0 ? 'text-green-400' : 'text-gray-500'}`}>{r.titlePoints > 0 ? `+${r.titlePoints}` : '0'}</span>
            </div>
            <div className="flex items-center gap-1 text-xs pr-5" dir="rtl">
              <span className="text-gray-600">ניחשת:</span>
              <span className="text-gray-400 truncate">{challenge.guessTitle || '—'}</span>
            </div>
          </div>
        )}
        {r.artistChecked && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs">
              <span className={`font-bold w-5 text-center ${r.artistCorrect ? 'text-green-400' : r.artistPartial ? 'text-amber-400' : 'text-red-400'}`}>{r.artistCorrect ? '✓' : r.artistPartial ? '~✓' : '✗'}</span>
              <span className="text-gray-400 w-6">אמן</span>
              <span className="text-white font-medium flex-1 text-right truncate">{r.artistAnswer}</span>
              <span dir="ltr" className={`font-bold w-8 text-left ${r.artistPoints > 0 ? 'text-green-400' : 'text-gray-500'}`}>{r.artistPoints > 0 ? `+${r.artistPoints}` : '0'}</span>
            </div>
            <div className="flex items-center gap-1 text-xs pr-5" dir="rtl">
              <span className="text-gray-600">ניחשת:</span>
              <span className="text-gray-400 truncate">{challenge.guessArtist || '—'}</span>
            </div>
          </div>
        )}
        <div className="border-t border-orange-800/50 pt-2 flex justify-between items-center">
          <span className="text-gray-400 text-xs">סה"כ (כולל עלות -5)</span>
          <span dir="ltr" className={`font-black text-xl ${r.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {r.net >= 0 ? '+' : ''}{r.net}
          </span>
        </div>
      </div>
    )
  }

  return null
}
