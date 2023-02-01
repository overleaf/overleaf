function formatTokenUsageStats(STATS) {
  const prettyStats = []
  const sortedStats = Object.entries(STATS).sort((a, b) =>
    a[0] > b[0] ? 1 : -1
  )
  const totalByName = {}
  for (const [key, n] of sortedStats) {
    const [name, version, collectionName, path, label] = key.split(':')
    totalByName[name] = (totalByName[name] || 0) + n
    prettyStats.push({ name, version, collectionName, path, label, n })
  }
  for (const row of prettyStats) {
    row.percentage = ((100 * row.n) / totalByName[row.name])
      .toFixed(2)
      .padStart(6)
  }

  if (prettyStats.length === 0) {
    console.warn('---')
    console.warn('Found 0 access tokens.')
    console.warn('---')
  } else {
    console.table(prettyStats)
  }
}

module.exports = { formatTokenUsageStats }
