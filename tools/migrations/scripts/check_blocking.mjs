// Predeploy migration gate.
//
// Run as a Cloud Deploy predeploy hook (a K8s Job using the service's released image).
// Blocks the rollout when there are pending migrations the image expects to have been applied.
//
// Exit codes:
//   0  nothing pending, or all pending migrations are non-blocking
//   1  one or more blocking pending migrations - rollout must not proceed
//   2  the check itself failed (e.g. Mongo unreachable) - fail closed
//
// A migration is non-blocking when it is tagged "nonblocking".

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import east from 'east'

const { MigrationManager } = east

const NON_BLOCKING_TAG = 'nonblocking'
const TAG = process.env.MIGRATION_TAG || 'saas'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(scriptDir, '..')

function skipRequested() {
  const value = process.env.SKIP_MIGRATION_CHECK
  return Boolean(value) && value !== '0' && value !== 'false'
}

async function findBlockingMigrations() {
  // east resolves .eastrc, the migrations dir and the adapter relative to the
  // working directory (same as `npm run migrations`). chdir so the check works
  // regardless of how the container invokes it.
  process.chdir(migrationsDir)
  // The adapter aborts unless a tag is passed on argv; we pass the tag to east
  // directly, so disable that CLI-only guard.
  process.env.SKIP_TAG_CHECK = '1'

  const manager = new MigrationManager()
  await manager.configure({ esModules: true })
  await manager.connect()

  try {
    const pending = await manager.getMigrationNames({ status: 'new' })
    const blocking = pending.length
      ? await manager.getMigrationNames({
          migrations: pending,
          tag: `${TAG} & !${NON_BLOCKING_TAG}`,
        })
      : []

    return { pending, blocking }
  } finally {
    await manager.disconnect()
  }
}

async function main() {
  if (skipRequested()) {
    console.warn(
      `SKIP_MIGRATION_CHECK is set ("${process.env.SKIP_MIGRATION_CHECK}") - ` +
        'bypassing the pending-migration gate. Only use this for incident recovery.'
    )
    return 0
  }

  const { pending, blocking } = await findBlockingMigrations()

  if (blocking.length === 0) {
    console.log(
      pending.length === 0
        ? `No pending "${TAG}" migrations. Safe to deploy.`
        : `No blocking pending "${TAG}" migrations. Safe to deploy.`
    )
    return 0
  }

  console.error(
    `${blocking.length} blocking pending "${TAG}" migration(s) must be applied before deploying:\n` +
      blocking.map(name => `  - ${name}`).join('\n') +
      `\n\nApply them, then retry the rollout. To intentionally ship a non-blocking ` +
      `migration, add the "${NON_BLOCKING_TAG}" tag.`
  )
  return 1
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Migration check failed; blocking rollout (fail closed):')
    console.error(err)
    process.exit(2)
  })
