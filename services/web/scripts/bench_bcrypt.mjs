import minimist from 'minimist'
import { promisify } from 'node:util'
import bcrypt from 'bcrypt'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
// https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'

const bcryptCompare = promisify(bcrypt.compare)
const bcryptGenSalt = promisify(bcrypt.genSalt)
const bcryptHash = promisify(bcrypt.hash)

const argv = minimist(process.argv.slice(2), {
  string: ['major', 'minor', 'concurrency', 'samples', 'password'],
  bool: ['hash', 'compare', 'verbose', 'table', 'csv'],
  default: {
    major: '12,13,14,15',
    minor: 'a',
    concurrency: '1,2,4,10,20',
    samples: 100,
    password: 'x'.repeat(72),
    hash: true,
    compare: true,
    verbose: true,
    table: true,
    csv: true,
  },
})

const SAMPLES = parseInt(argv.samples, 10)
const STATS = []

function asListOfInt(s) {
  return s.split(',').map(x => parseInt(x, 10))
}

async function computeHash(rounds, minor) {
  const salt = await bcryptGenSalt(rounds, minor)
  return await bcryptHash(argv.password, salt)
}

async function sample(concurrency, fn) {
  const stats = await promiseMapWithLimit(
    concurrency,
    new Array(SAMPLES).fill(0),
    async () => {
      const t0 = process.hrtime.bigint()
      await fn()
      const t1 = process.hrtime.bigint()
      return Number(t1 - t0) / 1e6
    }
  )
  const sum = stats.reduce((a, b) => a + b, 0)
  const avg = sum / SAMPLES
  stats.sort((a, b) => a - b)
  const median = stats[Math.ceil(SAMPLES / 2)]
  const p95 = stats[Math.ceil(SAMPLES * 0.95)]
  const min = stats[0]
  const max = stats[stats.length - 1]
  return Object.fromEntries(
    Object.entries({
      min,
      avg,
      median,
      p95,
      max,
    }).map(([key, value]) => [key, Math.ceil(value) + 'ms'])
  )
}

async function run(rounds, minor, concurrency) {
  if (argv.hash) {
    const stats = await sample(concurrency, async () => {
      await computeHash(rounds, minor)
    })
    STATS.push({
      kind: 'hash',
      rounds,
      concurrency,
      ...stats,
    })
    if (argv.verbose) console.log(STATS[STATS.length - 1])
  }
  if (argv.compare) {
    const hashedPassword = await computeHash(rounds, minor)
    const stats = await sample(concurrency, async () => {
      await bcryptCompare(argv.password, hashedPassword)
    })
    STATS.push({
      kind: 'compare',
      rounds,
      concurrency,
      ...stats,
    })
    if (argv.verbose) console.log(STATS[STATS.length - 1])
  }
}

async function main() {
  for (const rounds of asListOfInt(argv.major)) {
    for (const minor of argv.minor.split(',')) {
      for (const concurrency of asListOfInt(argv.concurrency)) {
        await run(rounds, minor, concurrency)
      }
    }
  }

  STATS.forEach(s => {
    s.samples = SAMPLES
  })

  if (argv.table) console.table(STATS)
  if (argv.csv) console.log(csv.stringify(STATS, { header: true }))
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
