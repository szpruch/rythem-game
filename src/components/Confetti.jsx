import { useMemo } from 'react'

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#f06595', '#74c0fc']
const SHAPES = ['rect', 'circle', 'strip']

function randomBetween(a, b) { return a + Math.random() * (b - a) }

export default function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: randomBetween(0, 100),
    color: COLORS[i % COLORS.length],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    size: randomBetween(6, 14),
    fallDuration: randomBetween(2.5, 5),
    swayDuration: randomBetween(1.5, 3),
    delay: randomBetween(0, 2.5),
  })), [])

  const fireworks = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: randomBetween(5, 95),
    y: randomBetween(5, 50),
    color: COLORS[i % COLORS.length],
    size: randomBetween(40, 100),
    delay: randomBetween(0, 1.5),
    duration: randomBetween(0.8, 1.4),
  })), [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {/* Fireworks bursts */}
      {fireworks.map(f => (
        <div
          key={f.id}
          style={{
            position: 'absolute',
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: f.size,
            height: f.size,
            borderRadius: '50%',
            border: `3px solid ${f.color}`,
            boxShadow: `0 0 12px ${f.color}, 0 0 24px ${f.color}`,
            animation: `firework ${f.duration}s ${f.delay}s ease-out infinite`,
          }}
        />
      ))}

      {/* Confetti pieces */}
      {pieces.map(p => {
        const borderRadius =
          p.shape === 'circle' ? '50%' :
          p.shape === 'strip'  ? '999px' : '2px'
        const height = p.shape === 'strip' ? p.size * 0.25 : p.size * 0.55

        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: -16,
              width: p.size,
              height,
              backgroundColor: p.color,
              borderRadius,
              animation: `confettiFall ${p.fallDuration}s ${p.delay}s ease-in infinite,
                          confettiSway ${p.swayDuration}s ${p.delay}s ease-in-out infinite`,
            }}
          />
        )
      })}
    </div>
  )
}
