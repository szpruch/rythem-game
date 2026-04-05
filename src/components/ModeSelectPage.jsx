import HelpButton from './HelpButton'

export default function ModeSelectPage({ onLocal, onOnline }) {
  return (
    <div className="min-h-screen bg-[#0d0d1f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        <div className="text-center">
          <img src="/Logo.jpg" alt="Maya & Tal" className="w-24 h-24 rounded-2xl object-cover shadow-lg mx-auto mb-4" />
          <h1 className="text-4xl font-black text-white" dir="rtl">🎵 חידון הקצב</h1>
        </div>

        <div className="w-full flex flex-col gap-4">
          <button
            onClick={onLocal}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl text-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">🏠</span>
            <span>שחק מקומי</span>
          </button>
          <button
            onClick={onOnline}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 rounded-2xl text-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">🌐</span>
            <span>שחק אונליין</span>
          </button>
        </div>

      </div>
      <HelpButton />
    </div>
  )
}
