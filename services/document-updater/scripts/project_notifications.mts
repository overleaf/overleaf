import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { createClient } from '@overleaf/redis-wrapper'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import mongodb from '../app/js/mongodb.js'
import Queue from 'bull'
import minimist from 'minimist'

logger.logger.level('fatal')

const argv = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'help'],
  alias: {
    n: 'dry-run',
    h: 'help',
  },
  default: {
    'dry-run': false,
    help: false,
  },
})

if (argv.help) {
  console.log(`
project_notifications.mts - Queue project update notifications

This script scans Redis for projects that have pending notification timestamps and queues
them for notification. It's used to notify project collaborators when changes have been
made to a project. Only projects with collaborators are processed.

Usage: node scripts/project_notifications.mts [options]

Options:
  -n, --dry-run    Show what would be done without making changes
  -h, --help       Show this help message

Examples:
  # Dry run to see what would be notified
  node scripts/project_notifications.mts --dry-run

  # Actually queue the notifications
  node scripts/project_notifications.mts
`)
  process.exit(0)
}

const dryRun = argv['dry-run']

const { db, ObjectId, READ_PREFERENCE_SECONDARY } = mongodb
const docUpdaterKeys = Settings.redis.documentupdater.key_schema
const redisClient = createClient(Settings.redis.documentupdater)

// Define Lua script to safely delete the key only if it matches expected value
redisClient.defineCommand('deleteProjectNotificationTimestamp', {
  numberOfKeys: 1,
  lua: `
    local projectNotificationKey = KEYS[1]
    local expectedTimestamp = ARGV[1]

    local currentTimestamp = redis.call('GET', projectNotificationKey)
    if currentTimestamp and currentTimestamp == expectedTimestamp then
      redis.call('DEL', projectNotificationKey)
      return 1
    end
    return 0
  `,
})

const queueRedisConfig = {
  host: process.env.QUEUES_REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.QUEUES_REDIS_PORT || '6379', 10),
  password: process.env.QUEUES_REDIS_PASSWORD,
}
const QUEUE_NAME = 'project-notification'
const MONGO_IN_BATCH_SIZE = 5000
const MONGO_BATCH_CONCURRENCY = 5
const PROGRESS_LOG_INTERVAL_MS = 15_000

const projectNotificationQueue = new Queue(QUEUE_NAME, {
  redis: queueRedisConfig,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: { count: 50000, age: 3600 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
})

async function main() {
  console.time('total')

  if (dryRun) {
    console.log('[DRY RUN MODE] - No changes will be made')
  }

  console.log('Scanning for projects that need to be notified...')
  const { projects, stats } = await getProjectsToNotify()
  console.log(
    `Scan complete: scanned=${stats.scanned}, matched=${stats.matched}, skippedNoCollaborators=${stats.skippedNoCollaborators}, skippedNoTimestamp=${stats.skippedNoTimestamp}, skippedInvalidTimestamp=${stats.skippedInvalidTimestamp}, skippedNoProjectId=${stats.skippedNoProjectId}`
  )
  console.log(
    `Collaborator lookups: cacheHitWithCollaborators=${stats.collaboratorCacheHitWithCollaborators}, cacheHitNoCollaborators=${stats.collaboratorCacheHitNoCollaborators}, cacheMissWithCollaborators=${stats.collaboratorCacheMissWithCollaborators}, cacheMissNoCollaborators=${stats.collaboratorCacheMissNoCollaborators}, mongoQueries=${stats.collaboratorMongoQueries}`
  )

  if (dryRun) {
    console.log('\n[DRY RUN] Projects that would be queued:')
    for (const { projectId, timestamp } of projects) {
      const date = new Date(parseInt(timestamp, 10))
      console.log(
        `  ${projectId}: ${timestamp} (${date.toISOString()}) - would be queued`
      )
    }
    console.timeEnd('total')
    return
  }

  console.log('Waiting for queue to be ready...')
  await projectNotificationQueue.isReady()
  console.log('Queue is ready.')

  let queued = 0
  let failed = 0
  let deleteMismatches = 0
  let lastProgressLog = Date.now()

  for (const { projectId, timestamp } of projects) {
    const numericTimestamp = parseInt(timestamp, 10)
    try {
      await projectNotificationQueue.add(
        { projectId, timestamp: numericTimestamp },
        {
          jobId: projectId,
          delay: 1000,
        }
      )

      const deleted = await deleteProjectNotificationTimestamp(
        projectId,
        timestamp
      )
      if (!deleted) {
        deleteMismatches++
      }

      queued++
    } catch (err) {
      failed++
      console.error(
        `Error scheduling notification for project ${projectId}:`,
        err
      )
    }

    if (Date.now() - lastProgressLog >= PROGRESS_LOG_INTERVAL_MS) {
      console.log(
        `Queue progress: queued=${queued}, failed=${failed} of ${projects.length}`
      )
      lastProgressLog = Date.now()
    }
  }

  console.log(
    `Queue complete: queued=${queued}, failed=${failed}, deleteMismatches=${deleteMismatches}`
  )
  console.timeEnd('total')
}

/**
 * Extract project ID from a ProjectNotificationTimestamp key
 * Key format: ProjectNotificationTimestamp:{project_id}
 */
function extractProjectId(key: string): string | undefined {
  const matches = key.match(/ProjectNotificationTimestamp:\{(.*?)\}/)
  if (matches) {
    return matches[1]
  }
}

type ProjectNotification = {
  projectId: string
  timestamp: string
}

/**
 * For a batch of project IDs, return the set of those that have collaborators.
 * Uses Redis caching with 1-2 hour randomized expiration to avoid repeated MongoDB queries.
 * Performs a single mget for cache hits, a single $in find for cache misses,
 * and a single pipelined setex to write back the results.
 */
async function getProjectsWithCollaborators(
  projectIds: string[],
  stats: NotificationStats
): Promise<Set<string>> {
  const projectsWithCollaborators = new Set<string>()
  if (projectIds.length === 0) return projectsWithCollaborators

  const cacheKeys = projectIds.map(id => `ProjectHasCollaborators:{${id}}`)
  const cached = await redisClient.mget(cacheKeys)

  const projectsNeedingMongoLookup: string[] = []
  for (const [i, id] of projectIds.entries()) {
    if (cached[i] === '1') {
      stats.collaboratorCacheHitWithCollaborators++
      projectsWithCollaborators.add(id)
    } else if (cached[i] === '0') {
      stats.collaboratorCacheHitNoCollaborators++
    } else {
      projectsNeedingMongoLookup.push(id)
    }
  }

  if (projectsNeedingMongoLookup.length === 0) return projectsWithCollaborators

  const batches: string[][] = []
  for (
    let i = 0;
    i < projectsNeedingMongoLookup.length;
    i += MONGO_IN_BATCH_SIZE
  ) {
    batches.push(projectsNeedingMongoLookup.slice(i, i + MONGO_IN_BATCH_SIZE))
  }

  const batchResults = await promiseMapWithLimit(
    MONGO_BATCH_CONCURRENCY,
    batches,
    async (batch: string[]) => {
      stats.collaboratorMongoQueries++
      return await db.projects
        .find(
          {
            _id: { $in: batch.map(id => new ObjectId(id)) },
            $or: [
              { 'collaberator_refs.0': { $exists: true } },
              { 'readOnly_refs.0': { $exists: true } },
              { 'reviewer_refs.0': { $exists: true } },
              { 'tokenAccessReadAndWrite_refs.0': { $exists: true } },
              { 'tokenAccessReadOnly_refs.0': { $exists: true } },
            ],
          },
          { projection: { _id: 1 }, readPreference: READ_PREFERENCE_SECONDARY }
        )
        .toArray()
    }
  )

  const positives = new Set(
    batchResults.flatMap(docs => docs.map(d => d._id.toString()))
  )

  const pipeline = redisClient.pipeline()
  for (const id of projectsNeedingMongoLookup) {
    // Use random TTL between 1-2 hours (3600-7200 seconds) to smooth out cache expiration
    const ttl = 3600 + Math.floor(Math.random() * 3600)
    const hit = positives.has(id)
    if (hit) {
      stats.collaboratorCacheMissWithCollaborators++
      projectsWithCollaborators.add(id)
    } else {
      stats.collaboratorCacheMissNoCollaborators++
    }
    pipeline.setex(`ProjectHasCollaborators:{${id}}`, ttl, hit ? '1' : '0')
  }
  await pipeline.exec()

  return projectsWithCollaborators
}

/**
 * Scan Redis for all projectNotificationTimestamp keys and return list of projects with timestamps
 */
type NotificationStats = {
  scanned: number
  matched: number
  skippedNoCollaborators: number
  skippedNoTimestamp: number
  skippedInvalidTimestamp: number
  skippedNoProjectId: number
  collaboratorCacheHitWithCollaborators: number
  collaboratorCacheHitNoCollaborators: number
  collaboratorCacheMissWithCollaborators: number
  collaboratorCacheMissNoCollaborators: number
  collaboratorMongoQueries: number
}

async function getProjectsToNotify(): Promise<{
  projects: ProjectNotification[]
  stats: NotificationStats
}> {
  const nodes = (typeof redisClient.nodes === 'function'
    ? redisClient.nodes('master')
    : undefined) || [redisClient]

  const projects: ProjectNotification[] = []
  const stats: NotificationStats = {
    scanned: 0,
    matched: 0,
    skippedNoCollaborators: 0,
    skippedNoTimestamp: 0,
    skippedInvalidTimestamp: 0,
    skippedNoProjectId: 0,
    collaboratorCacheHitWithCollaborators: 0,
    collaboratorCacheHitNoCollaborators: 0,
    collaboratorCacheMissWithCollaborators: 0,
    collaboratorCacheMissNoCollaborators: 0,
    collaboratorMongoQueries: 0,
  }
  let lastProgressLog = Date.now()

  console.time('redis-scan')
  try {
    for (const node of nodes) {
      const stream = node.scanStream({
        match: docUpdaterKeys.projectNotificationTimestamp({ project_id: '*' }),
        count: 1000,
      })

      for await (const keys of stream) {
        if (keys.length === 0) {
          continue
        }

        const timestamps = await redisClient.mget(keys)

        // Extract valid (projectId, timestamp) pairs from this batch
        const candidates: ProjectNotification[] = []
        for (const [index, key] of keys.entries()) {
          stats.scanned++
          const projectId = extractProjectId(key as string)
          const timestamp = timestamps[index]

          if (!projectId) {
            stats.skippedNoProjectId++
            console.error('Could not extract project ID from key:', key)
            continue
          }

          if (!timestamp) {
            stats.skippedNoTimestamp++
            console.error(`No timestamp found for key: ${key}`)
            continue
          }

          const numericTimestamp = parseInt(timestamp, 10)
          if (Number.isNaN(numericTimestamp)) {
            stats.skippedInvalidTimestamp++
            console.error(
              `Non-numeric timestamp for project ${projectId}: ${timestamp}`
            )
            continue
          }

          candidates.push({ projectId, timestamp })
        }

        // Bulk-check collaborators for the whole batch
        const projectsWithCollaborators = await getProjectsWithCollaborators(
          candidates.map(c => c.projectId),
          stats
        )

        for (const c of candidates) {
          if (!projectsWithCollaborators.has(c.projectId)) {
            stats.skippedNoCollaborators++
            continue
          }
          stats.matched++
          projects.push(c)
        }

        if (Date.now() - lastProgressLog >= PROGRESS_LOG_INTERVAL_MS) {
          console.log(
            `Scan progress: scanned=${stats.scanned}, matched=${stats.matched}, skipped=${stats.scanned - stats.matched}`
          )
          lastProgressLog = Date.now()
        }
      }
    }
  } finally {
    console.timeEnd('redis-scan')
  }

  return { projects, stats }
}

/**
 * Delete the projectNotificationTimestamp key for a project
 * Only deletes if the timestamp matches the expected value to avoid race conditions
 */
async function deleteProjectNotificationTimestamp(
  projectId: string,
  expectedTimestamp: string
): Promise<boolean> {
  const key = docUpdaterKeys.projectNotificationTimestamp({
    project_id: projectId,
  })
  const deleted = await redisClient.deleteProjectNotificationTimestamp(
    key,
    expectedTimestamp
  )
  return deleted === 1
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error('Error scanning for project notifications:', error)
    console.timeEnd('total')
    process.exit(1)
  })
  .finally(async () => {
    // Close the Bull queue connection
    await projectNotificationQueue.close()
  })
