/* eslint-disable no-console */
// silence settings module
console.log = function () {}
const fs = require('fs')
const path = require('path')
const Settings = require('@overleaf/settings')

const MODULES = Settings.moduleImportSequence
const [TARGET = 'test_acceptance', shardIndexArg, shardTotalArg] =
  process.argv.slice(2)

let names = MODULES
if (shardIndexArg && shardTotalArg) {
  const shardIndex = parseInt(shardIndexArg, 10)
  const shardTotal = parseInt(shardTotalArg, 10)
  const timingsPath = path.join(__dirname, 'module-timings.json')
  const timings = fs.existsSync(timingsPath)
    ? JSON.parse(fs.readFileSync(timingsPath, 'utf8'))
    : []
  const msByName = new Map(timings.map(({ name, ms }) => [name, ms]))

  // Greedy LPT (longest processing time first) bin-packing: sort modules by
  // descending time, then drop each one into whichever shard currently has
  // the smallest total, for a roughly time-fair split of work across shards.
  const shards = Array.from({ length: shardTotal }, () => ({
    totalMs: 0,
    names: [],
  }))
  const sortedByMsDesc = MODULES.slice().sort(
    (a, b) => (msByName.get(b) || 0) - (msByName.get(a) || 0)
  )
  for (const name of sortedByMsDesc) {
    const shard = shards.reduce((lightest, s) =>
      s.totalMs < lightest.totalMs ? s : lightest
    )
    shard.names.push(name)
    shard.totalMs += msByName.get(name) || 0
  }
  names = shards[shardIndex - 1].names
}

if (TARGET === '--name-only') {
  console.debug(names.join('\n'))
} else {
  const targets = names.map(name => `modules/${name}/${TARGET}`)
  console.debug(targets.length > 0 ? targets.join('\n') : 'no_more_targets')
}
