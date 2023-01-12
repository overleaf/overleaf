const fs = require('fs')
const Path = require('path')

const LOCALES = Path.join(__dirname, '../../locales')
const SORT_BY_PROGRESS = process.argv.includes('--sort-by-progress')

function count(file) {
  return Object.keys(require(Path.join(LOCALES, file))).length
}

async function main() {
  const EN = count('en.json')
  const rows = []

  for (const file of await fs.promises.readdir(LOCALES)) {
    if (file === 'README.md') continue
    const n = count(file)
    const name = file.replace('.json', '')
    rows.push({
      name,
      done: n,
      missing: EN - n,
      progress: ((100 * n) / EN).toFixed(2).padStart(5, ' ') + '%',
    })
  }
  if (SORT_BY_PROGRESS) {
    rows.sort((a, b) => b.done - a.done)
  }
  console.table(rows)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
