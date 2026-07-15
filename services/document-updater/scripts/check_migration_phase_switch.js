/**
 * Pre-flight check for switching the real-time -> document-updater update queue
 * migration phase (PENDING_UPDATES_MIGRATION_PHASE).
 *
 *   phase 1: legacy per-doc queue only
 *   phase 2: producer writes the per-project queue; consumer drains both
 *   phase 3: per-project queue only
 *
 * Going to phase 3 is only safe once no data can be stranded in the legacy
 * per-doc queues (because the phase-3 consumer stops reading them). This script
 * verifies that and exits non-zero when the switch is unsafe.
 *
 * It is READ-ONLY (SCAN / LLEN / LRANGE only - never KEYS) and safe to run at
 * any time. In a redis cluster it SCANs every master node, since the per-doc
 * keys are spread across slots.
 *
 * Usage:
 *   node scripts/check_migration_phase_switch.js --current 2 --target 3
 */
const { setTimeout } = require('node:timers/promises')
const minimist = require('minimist')
const Settings = require('@overleaf/settings')
const { rclient } = require('./../app/js/RedisManager')

// Window size when walking a dispatch list tail -> head.
const LIST_CHUNK_SIZE = 1000

/**
 * List all cluster master nodes, or the plain client outside a cluster.
 *
 * @return {Array<Object>}
 */
function getNodes() {
  return (
    (typeof rclient.nodes === 'function'
      ? rclient.nodes('master')
      : undefined) || [rclient]
  )
}

/**
 * Non-blocking SCAN across all cluster master nodes.
 *
 * @param {string} pattern - a redis MATCH pattern
 * @yields {string} matching keys
 */
async function* scanKeys(pattern) {
  for (const node of getNodes()) {
    let cursor = '0'
    do {
      const [next, keys] = await node.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        1000
      )
      cursor = next
      for (const key of keys) {
        yield key
      }
      if (cursor !== '0') {
        await setTimeout(10) // be gentle on redis
      }
    } while (cursor !== '0')
  }
}

/**
 * Are there any non-empty legacy per-doc queues left?
 *
 * @return {Promise<{nonEmptyDocs: number, totalOps: number}>}
 */
async function checkPerDocQueues() {
  let nonEmptyDocs = 0
  let totalOps = 0
  for await (const key of scanKeys('PendingUpdates:{*}')) {
    const length = await rclient.llen(key)
    if (length > 0) {
      nonEmptyDocs++
      totalOps += length
    }
  }
  return { nonEmptyDocs, totalOps }
}

/**
 * Are there any legacy "<proj>:<doc>" markers still sitting on the dispatch
 * lists? A colon means a phase-1 producer is still writing. We snapshot the
 * length and walk each list tail -> head in bounded windows, rather than
 * materialising the whole list in one LRANGE. The lists are only popped from
 * the head (BLPOP) and appended at the tail (RPUSH), so an entry's index only
 * ever decreases; sweeping tail -> head with contiguous windows therefore
 * never skips an entry that is still queued (though a fast-draining entry can
 * ride the window boundary down and be read several times - harmless for a
 * colon scan). The only entries we don't observe are ones drained mid-walk
 * (already processed) or pushed after we started. The exhaustive per-doc SCAN
 * above is in any case the authoritative gate; a colon found here is just a
 * strong extra signal.
 *
 * @return {Promise<{legacyMarkers: number, inspectedEntries: number}>}
 */
async function checkDispatchListsForLegacyMarkers() {
  const shardCount = Settings.dispatcherCount
  let legacyMarkers = 0
  let inspectedEntries = 0
  for (let shard = 0; shard < shardCount; shard++) {
    const listKey =
      shard === 0 ? 'pending-updates-list' : `pending-updates-list-${shard}`
    const length = await rclient.llen(listKey)
    for (let end = length; end > 0; end -= LIST_CHUNK_SIZE) {
      const start = Math.max(0, end - LIST_CHUNK_SIZE)
      const entries = await rclient.lrange(listKey, start, end - 1)
      for (const marker of entries) {
        inspectedEntries++
        if (marker.includes(':')) {
          legacyMarkers++
        }
      }
    }
  }
  return { legacyMarkers, inspectedEntries }
}

/**
 * Check whether switching the migration phase is safe.
 *
 * @param {number} current - the phase currently running
 * @param {number} target - the phase to switch to
 * @return {Promise<boolean>} whether the switch is safe
 */
async function checkSwitch(current, target) {
  console.log(`Checking switch from phase ${current} -> ${target}`)

  if (Math.abs(target - current) > 1) {
    console.warn(
      `WARNING: ${current} -> ${target} is not an adjacent transition. ` +
        'Roll the phase one step at a time.'
    )
  }

  // The only gated transition is enabling phase 3 (consumer stops reading the
  // per-doc queues). Everything else is safe with the dual-read consumer.
  if (target < 3) {
    console.log(
      'Target phase < 3: the dual-read consumer drains both queues, so this ' +
        'switch (incl. roll-backs) is safe.'
    )
    return true
  }

  const { nonEmptyDocs, totalOps } = await checkPerDocQueues()
  const { legacyMarkers, inspectedEntries } =
    await checkDispatchListsForLegacyMarkers()

  console.log(
    `Legacy per-doc queues with pending updates: ${nonEmptyDocs} (${totalOps} ops)`
  )
  console.log(
    `Legacy "<proj>:<doc>" markers found across ${inspectedEntries} dispatch ` +
      `list entries: ${legacyMarkers}`
  )

  const safe = nonEmptyDocs === 0 && legacyMarkers === 0
  if (safe) {
    console.log(
      'SAFE: no legacy per-doc data remains; phase 3 will not strand updates.'
    )
  } else {
    console.error(
      'UNSAFE: legacy per-doc data still present. Keep the producer at phase ' +
        '>= 2 and wait for the per-doc queues to drain before switching to ' +
        'phase 3.'
    )
  }
  return safe
}

/**
 * Parse the command line arguments and run the check.
 *
 * @return {Promise<boolean>} whether the switch is safe
 */
async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['help'],
    alias: { h: 'help' },
  })

  if (argv.help || argv.current == null || argv.target == null) {
    console.log(`
Usage: node scripts/check_migration_phase_switch.js --current N --target M

Options:
  --current   The phase currently running (1, 2 or 3)
  --target    The phase you want to switch to (1, 2 or 3)
  --help, -h  Show this help message
`)
    process.exit(argv.help ? 0 : 1)
  }

  const current = parseInt(argv.current, 10)
  const target = parseInt(argv.target, 10)
  return await checkSwitch(current, target)
}

main()
  .then(safe => {
    process.exit(safe ? 0 : 1)
  })
  .catch(error => {
    console.error('Error running phase-switch check', error)
    process.exit(2)
  })
