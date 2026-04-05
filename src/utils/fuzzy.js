function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function normalize(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, '')         // strip anything in brackets
    .replace(/\[.*?\]/g, '')         // strip anything in square brackets
    .replace(/[\u0591-\u05C7]/g, '') // strip Hebrew nikud (vowel marks)
    .replace(/['".,!?-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns true if guess is close enough to answer
export function isCloseMatch(guess, answer) {
  if (!guess || !answer) return false
  const g = normalize(guess)
  const a = normalize(answer)
  if (g === a) return true
  const dist = levenshtein(g, a)
  const threshold = Math.max(1, Math.floor(a.length * 0.2)) // allow 20% edits
  return dist <= threshold
}

// Returns score for year guess: +4 / +2 / 0 / -2 / -4
export function yearScore(guess, answer) {
  if (!guess || !guess.trim()) return 0
  const g = parseInt(guess, 10)
  const a = parseInt(answer, 10)
  if (isNaN(g) || isNaN(a)) return 0
  const diff = Math.abs(g - a)
  if (diff <= 1)  return 4
  if (diff <= 3)  return 2
  if (diff <= 5)  return 0
  if (diff <= 10) return -2
  return -4
}
