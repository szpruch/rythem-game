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
  const threshold = Math.max(1, Math.floor(a.length * 0.3)) // allow 30% edits
  return dist <= threshold
}

// For year: accept exact or ±1
export function isYearMatch(guess, answer) {
  const g = parseInt(guess, 10)
  const a = parseInt(answer, 10)
  if (isNaN(g) || isNaN(a)) return false
  return Math.abs(g - a) <= 1
}
