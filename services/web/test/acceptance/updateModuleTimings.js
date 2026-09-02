/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const ENTER_LEAVE_RE =
  /^\[([^\]]+)] make\[\d+]: (Entering|Leaving) directory '.*\/modules\/([^/']+)'$/

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error(
    'Usage: node updateModuleTimings.js <log-file> [<log-file> ...]'
  )
  process.exit(1)
}

const totalMsByName = new Map()
const enteredAtByName = new Map()

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (const line of lines) {
    const match = line.match(ENTER_LEAVE_RE)
    if (!match) continue
    const [, timestamp, action, name] = match
    const time = new Date(timestamp).getTime()
    if (action === 'Entering') {
      if (enteredAtByName.has(name)) {
        throw new Error(
          `module "${name}" entered again before leaving. Make sure to provide logs of the SaaS module stages.`
        )
      }
      enteredAtByName.set(name, time)
    } else if (enteredAtByName.has(name)) {
      totalMsByName.set(
        name,
        (totalMsByName.get(name) || 0) + (time - enteredAtByName.get(name))
      )
      enteredAtByName.delete(name)
    }
  }
}

const result = Array.from(totalMsByName, ([name, ms]) => ({ name, ms })).sort(
  (a, b) => a.name.localeCompare(b.name)
)

const outputPath = path.join(__dirname, 'module-timings.json')
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n')
console.log(`Wrote ${result.length} module timings to ${outputPath}`)
