import { createPortal } from 'react-dom'

export default function HelpModal({ onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#13132b] border border-indigo-900/50 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header — title RIGHT (first in RTL), ✕ LEFT (last in RTL) */}
        <div className="sticky top-0 bg-[#13132b] border-b border-indigo-900/40 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-xl font-bold text-white">❓ איך משחקים?</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none transition">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">

          {/* Game flow */}
          <section className="flex flex-col gap-2">
            <h3 className="text-indigo-400 font-bold text-base uppercase tracking-wide text-right">מהלך המשחק</h3>
            <p className="text-gray-300 text-sm leading-relaxed text-right">כל שחקן מקבל בתורו שיר אקראי מתוך המאגר.</p>
            <p className="text-gray-300 text-sm leading-relaxed text-right">השחקן יכול לבחור רמזים לפי ראות עיניו – אפשר:</p>
            <ul className="flex flex-col gap-1.5">
              {/* In RTL flex: first item → RIGHT (emoji as bullet), second → LEFT (text) */}
              <BulletItem emoji="🎵">לשמוע קטעים קצרים מתחילת השיר</BulletItem>
              <BulletItem emoji="📝">לקרוא שורות (ברצף) מתוך מילות השיר</BulletItem>
              <BulletItem emoji="🌐">לקרוא את השורות הראשונות מתורגמות לאנגלית</BulletItem>
            </ul>
            <p className="text-yellow-400/80 text-xs leading-relaxed bg-yellow-400/10 rounded-xl px-3 py-2 text-right">
              💡 ניתן לבחור רמזים מכל סוג, בכל רמה ובכל כמות — אך כל רמז עולה בניקוד
            </p>
          </section>

          {/* Guessing */}
          <section className="flex flex-col gap-2">
            <h3 className="text-indigo-400 font-bold text-base uppercase tracking-wide text-right">הניחוש</h3>
            <p className="text-gray-300 text-sm leading-relaxed text-right">לאחר קבלת הרמזים, השחקן מנחש את:</p>
            <ul className="flex flex-col gap-1">
              <CheckItem>שם השיר</CheckItem>
              <CheckItem>שם המבצע</CheckItem>
              <CheckItem>שנת יציאת השיר</CheckItem>
            </ul>
          </section>

          {/* Score for correct answers */}
          <section className="flex flex-col gap-2">
            <h3 className="text-indigo-400 font-bold text-base uppercase tracking-wide text-right">ניקוד על זיהוי נכון</h3>
            <div className="flex flex-col gap-1.5">
              <ScoreRow label="שם השיר"  points="+10" color="text-green-400" />
              <ScoreRow label="שם המבצע (כל המבצעים)" points="+6"  color="text-green-400" />
              <ScoreRow label="שם מבצע אחד בלבד (מתוך כמה)" points="+3" color="text-amber-400" />
              <ScoreRow label="טעות בשם השיר או המבצע" points="0" color="text-gray-400" />
              <div className="border-t border-gray-700/50 my-1" />
              <ScoreRow label="שנה (±1)"  points="+4" color="text-green-400" />
              <ScoreRow label="שנה (±3)"  points="+2" color="text-green-400" />
              <ScoreRow label="שנה (±5)"  points="0"  color="text-gray-400" />
              <ScoreRow label="שנה (±10)" points="−2" color="text-red-400" />
              <ScoreRow label="טעות של יותר מ־10 שנים" points="−4" color="text-red-400" />
            </div>
          </section>

          {/* Challenge */}
          <section className="flex flex-col gap-2">
            <h3 className="text-orange-400 font-bold text-base uppercase tracking-wide text-right">⚔️ אתגר</h3>
            <p className="text-gray-300 text-sm leading-relaxed text-right">
              לאחר שהשחקן הפעיל חושף את תשובתו, שאר השחקנים רואים מה הוא ניחש ויש להם <span className="text-white font-bold">10 שניות</span> לאתגר אותו.
            </p>
            <ul className="flex flex-col gap-1.5">
              <BulletItem emoji="⚡">רק שחקן אחד יכול לאתגר — מי שלוחץ ראשון זוכה</BulletItem>
              <BulletItem emoji="💸">עלות האתגר: −5 נקודות</BulletItem>
              <BulletItem emoji="🎯">ניתן להרוויח רק על שדות שהשחקן הפעיל טעה בהם (שיר / אמן)</BulletItem>
              <BulletItem emoji="😏">אתגור ניחוש מקורב בלבד (~✓) יסומן "אל תהיה קטנוני!"</BulletItem>
            </ul>
            <div className="flex flex-col gap-1.5 mt-1">
              <ScoreRow label="שם שיר נכון (שהפעיל פספס)" points="+10" color="text-green-400" />
              <ScoreRow label="שם אמן נכון (שהפעיל פספס)" points="+6"  color="text-green-400" />
              <ScoreRow label="עלות האתגר"                  points="−5"  color="text-red-400" />
            </div>
          </section>

          {/* Clue penalties */}
          <section className="flex flex-col gap-2">
            <h3 className="text-indigo-400 font-bold text-base uppercase tracking-wide text-right">ניקוד על רמזים</h3>
            <p className="text-yellow-400/80 text-xs leading-relaxed bg-yellow-400/10 rounded-xl px-3 py-2 text-right">
              💡 הרמז הראשון משכבה 1 הוא חינם — השאר עולים −1
            </p>
            <div className="flex flex-col gap-3">
              <ClueLevel title="שכבה 1" penalty="חינם / −1" color="bg-green-900/40 border-green-700/40">
                <ClueLine>3 שניות מהשיר</ClueLine>
                <ClueLine>שורה 1 בעברית</ClueLine>
                <ClueLine>שורה 1 באנגלית</ClueLine>
              </ClueLevel>
              <ClueLevel title="שכבה 2" penalty="−4" color="bg-yellow-900/40 border-yellow-700/40">
                <ClueLine>6 שניות מהשיר</ClueLine>
                <ClueLine>שורה 2 בעברית</ClueLine>
                <ClueLine>שורה 2 באנגלית</ClueLine>
              </ClueLevel>
              <ClueLevel title="שכבה 3" penalty="−8" color="bg-orange-900/40 border-orange-700/40">
                <ClueLine>9 שניות מהשיר</ClueLine>
                <ClueLine>שורה 3 בעברית</ClueLine>
                <ClueLine>שורה 3 באנגלית</ClueLine>
              </ClueLevel>
              <ClueLevel title="רמז סופי" penalty="−12" color="bg-red-900/40 border-red-700/40">
                <ClueLine>השמעת השיר המלא</ClueLine>
              </ClueLevel>
            </div>
          </section>

        </div>
      </div>
    </div>,
    document.body
  )
}

/* Emoji bullet: emoji RIGHT (first in RTL), text LEFT */
function BulletItem({ emoji, children }) {
  return (
    <li className="flex items-start gap-2 text-gray-300 text-sm">
      <span className="mt-0.5">{emoji}</span>
      <span>{children}</span>
    </li>
  )
}

/* Check item: ✅ RIGHT (first in RTL), text LEFT */
function CheckItem({ children }) {
  return (
    <li className="flex items-center gap-2 text-gray-200 text-sm">
      <span>✅</span>
      <span>{children}</span>
    </li>
  )
}

/* Score row: label RIGHT in pill (first in RTL), points LEFT (last in RTL) */
function ScoreRow({ label, points, color }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="bg-gray-800 px-3 py-1 rounded-lg text-gray-200 text-sm">{label}</span>
      <span dir="ltr" className={`font-bold text-sm ${color}`}>{points}</span>
    </div>
  )
}

/* ClueLevel: title RIGHT (first in RTL), penalty LEFT (last in RTL) */
function ClueLevel({ title, penalty, color, children }) {
  const penaltyColor = penalty === 'חינם' ? 'text-green-400' : 'text-red-400'
  return (
    <div className={`border rounded-2xl px-4 py-3 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-bold text-sm">{title}</span>
        <span dir="ltr" className={`font-bold text-sm ${penaltyColor}`}>{penalty}</span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

/* ClueLine: bullet RIGHT (first in RTL), text LEFT */
function ClueLine({ children }) {
  return (
    <div className="flex items-center gap-2 text-gray-300 text-xs">
      <span className="text-gray-500">•</span>
      <span>{children}</span>
    </div>
  )
}
