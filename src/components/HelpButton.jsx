import { useState } from 'react'
import HelpModal from './HelpModal'

export default function HelpButton() {
  const [show, setShow] = useState(false)
  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 left-4 z-40 bg-gray-800 hover:bg-gray-700 text-white w-10 h-10 rounded-full text-base flex items-center justify-center shadow-lg transition"
        aria-label="עזרה"
      >
        ❓
      </button>
      {show && <HelpModal onClose={() => setShow(false)} />}
    </>
  )
}
