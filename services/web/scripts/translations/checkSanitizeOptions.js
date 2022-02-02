const Path = require('path')
const fs = require('fs')
const { sanitize } = require('./sanitize')

async function main() {
  let ok = true
  const base = Path.join(__dirname, '/../../locales')
  for (const name of await fs.promises.readdir(base)) {
    if (name === 'README.md') continue
    const blob = await fs.promises.readFile(
      Path.join(__dirname, '/../../locales', name),
      'utf-8'
    )
    const locales = JSON.parse(blob)

    for (const key of Object.keys(locales)) {
      const want = locales[key]
      const got = sanitize(locales[key])
      if (got !== want) {
        if (want === 'Editor & PDF' && got === 'Editor &amp; PDF') {
          // Ignore this mismatch. React cannot handle escaped labels.
          continue
        }
        ok = false
        console.warn(`${name}: ${key}: want: ${want}`)
        console.warn(`${name}: ${key}:  got: ${got}`)
      }
    }
  }
  if (!ok) {
    throw new Error('Check the logs, some values changed.')
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
