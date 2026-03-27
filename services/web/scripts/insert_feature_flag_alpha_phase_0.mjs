import { scriptRunner } from './lib/ScriptRunner.mjs'
import { db } from '../app/src/infrastructure/mongodb.mjs'
import minimist from 'minimist'

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined
const splitTestName = argv._[0]

if (!splitTestName) {
  console.error(
    'Usage: node scripts/insert_feature_flag_alpha_phase_0.mjs <split-test-name> [--commit]'
  )
  console.error(
    '\nInserts a new version 1 (alpha phase, 0% rollout, active) and renumbers existing versions.'
  )
  console.error('Without --commit, runs in dry-run mode and shows a diff.')
  process.exit(1)
}

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'

function formatDiff(before, after) {
  const aLines = before.split('\n')
  const bLines = after.split('\n')
  const m = aLines.length
  const n = bLines.length

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const result = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.unshift(`  ${aLines[i - 1]}`)
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift(`${GREEN}+ ${bLines[j - 1]}${RESET}`)
      j--
    } else {
      result.unshift(`${RED}- ${aLines[i - 1]}${RESET}`)
      i--
    }
  }

  return result.join('\n')
}

async function main() {
  const splitTest = await db.splittests.findOne({ name: splitTestName })

  if (!splitTest) {
    throw new Error(`Split test '${splitTestName}' not found`)
  }

  if (!splitTest.versions || splitTest.versions.length === 0) {
    throw new Error(`Split test '${splitTestName}' has no versions`)
  }

  const firstVersion = splitTest.versions[0]

  const newVersion = {
    ...firstVersion,
    versionNumber: 1,
    phase: 'alpha',
    active: true,
    variants: firstVersion.variants.map(v => ({
      ...v,
      rolloutPercent: 0,
      rolloutStripes: [],
    })),
    createdAt: new Date(firstVersion.createdAt.getTime() - 1000),
    comment: `Inserted alpha phase 0% rollout version (based on v${firstVersion.versionNumber})`,
  }

  const updatedVersions = [
    newVersion,
    ...splitTest.versions.map(v => ({
      ...v,
      versionNumber: v.versionNumber + 1,
    })),
  ]

  const beforeStr = JSON.stringify(splitTest.versions, null, 2)
  const afterStr = JSON.stringify(updatedVersions, null, 2)

  console.log(`\nSplit test: ${splitTestName}`)
  console.log(`Current versions: ${splitTest.versions.length}`)
  console.log(`After: ${updatedVersions.length} versions`)
  console.log('\n--- versions diff ---')
  console.log(formatDiff(beforeStr, afterStr))
  console.log('--- end diff ---\n')

  if (commit) {
    await db.splittests.updateOne(
      { name: splitTestName },
      { $set: { versions: updatedVersions } }
    )
    console.log(
      `Successfully inserted alpha phase 0% version for '${splitTestName}'`
    )
  } else {
    console.log('Dry run complete. Pass --commit to apply changes.')
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
