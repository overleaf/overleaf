import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { createClient } from '@overleaf/redis-wrapper'
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
project_notifications.ts - Queue project update notifications

This script scans Redis for projects that have pending notification timestamps and queues
them for notification. It's used to notify project collaborators when changes have been
made to a project. Only projects with collaborators are processed.

Usage: project_notifications.ts [options]

Options:
  -n, --dry-run    Show what would be done without making changes
  -h, --help       Show this help message

Examples:
  # Dry run to see what would be notified
  project_notifications.ts --dry-run

  # Actually queue the notifications
  project_notifications.ts
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
  if (dryRun) {
    console.log('[DRY RUN MODE] - No changes will be made')
  }

  console.log('Scanning for projects that need to be notified...')
  const projects = await getProjectsToNotify()
  console.log(`\nFound ${projects.length} project(s) that need to be notified`)

  if (dryRun) {
    console.log('\n[DRY RUN] Projects that would be queued:')
    for (const { projectId, timestamp } of projects) {
      const date = new Date(parseInt(timestamp))
      console.log(
        `  ${projectId}: ${timestamp} (${date.toISOString()}) - would be queued`
      )
    }
    return
  }

  console.log('Waiting for queue to be ready...')
  await projectNotificationQueue.isReady()
  console.log('Queue is ready.')

  for (const { projectId, timestamp } of projects) {
    try {
      await projectNotificationQueue.add(
        { projectId, timestamp },
        {
          jobId: projectId,
        },
        {
          delay: 1000,
        }
      )

      // Delete the timestamp key after scheduling (only if it still matches)
      await deleteProjectNotificationTimestamp(projectId, timestamp)

      const date = new Date(parseInt(timestamp))
      console.log(
        `  ${projectId}: ${timestamp} (${date.toISOString()}) - queued`
      )
    } catch (err) {
      console.error(
        `Error scheduling notification for project ${projectId}:`,
        err
      )
    }
  }
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
 * Check if a project has any collaborators (excluding owner)
 * Uses Redis caching with 1 hour expiration to avoid repeated MongoDB queries
 */
async function projectHasCollaborators(projectId: string): Promise<boolean> {
  // Check Redis cache first
  const cacheKey = `ProjectHasCollaborators:{${projectId}}`
  const cachedResult = await redisClient.get(cacheKey)

  if (cachedResult !== null) {
    return cachedResult === '1'
  }

  // Cache miss - query MongoDB
  const hasCollaborators = await db.projects.findOne(
    {
      _id: new ObjectId(projectId),
      $or: [
        { 'collaberator_refs.0': { $exists: true } }, // check that first element in array exists
        { 'readOnly_refs.0': { $exists: true } },
        { 'reviewer_refs.0': { $exists: true } },
        { 'tokenAccessReadAndWrite_refs.0': { $exists: true } },
        { 'tokenAccessReadOnly_refs.0': { $exists: true } },
      ],
    },
    { projection: { _id: 1 }, readPreference: READ_PREFERENCE_SECONDARY }
  )

  // Use random TTL between 1-2 hours (3600-7200 seconds) to smooth out cache expiration
  const randomTTL = 3600 + Math.floor(Math.random() * 3600)

  if (hasCollaborators === null) {
    // Cache false result for non-existent projects
    await redisClient.setex(cacheKey, randomTTL, '0')
    return false
  }

  // Cache the result in Redis
  await redisClient.setex(cacheKey, randomTTL, hasCollaborators ? '1' : '0')

  return true
}

/**
 * Scan Redis for all projectNotificationTimestamp keys and return list of projects with timestamps
 */
async function getProjectsToNotify(): Promise<ProjectNotification[]> {
  const nodes = (typeof redisClient.nodes === 'function'
    ? redisClient.nodes('master')
    : undefined) || [redisClient]

  const projects: ProjectNotification[] = []

  for (const node of nodes) {
    console.log('Scanning Redis node for projectNotificationTimestamp keys...')

    // Scan for all ProjectNotificationTimestamp keys
    const stream = node.scanStream({
      match: docUpdaterKeys.projectNotificationTimestamp({ project_id: '*' }),
    })

    for await (const keys of stream) {
      if (keys.length === 0) {
        continue
      }

      console.log(`Found batch of ${keys.length} keys`)

      // Get timestamps for all keys in this batch
      const timestamps = await redisClient.mget(keys)

      // Extract project IDs and pair with timestamps, checking for collaborators
      for (const [index, key] of keys.entries()) {
        const projectId = extractProjectId(key as string)
        const timestamp = timestamps[index]

        if (!projectId) {
          console.log('Could not extract project ID from key:', key)
          continue
        }

        if (!timestamp) {
          console.log('No timestamp found for key:', key)
          continue
        }

        // Check if project has collaborators before adding to list
        const hasCollaborators = await projectHasCollaborators(projectId)
        if (!hasCollaborators) {
          console.log(`Skipping project ${projectId} - no collaborators`)
          continue
        }

        projects.push({ projectId, timestamp })
      }
    }
  }

  return projects
}

/**
 * Delete the projectNotificationTimestamp key for a project
 * Only deletes if the timestamp matches the expected value to avoid race conditions
 */
async function deleteProjectNotificationTimestamp(
  projectId: string,
  expectedTimestamp: string
): Promise<void> {
  const key = docUpdaterKeys.projectNotificationTimestamp({
    project_id: projectId,
  })
  const deleted = await redisClient.deleteProjectNotificationTimestamp(
    key,
    expectedTimestamp
  )
  if (deleted === 1) {
    console.log(`Deleted timestamp key for project ${projectId}`)
  } else {
    console.log(
      `Timestamp key for project ${projectId} was not deleted (value mismatch or key not found)`
    )
  }
}

main()
  .then(() => {
    console.log('\nDone.')
    process.exit(0)
  })
  .catch(error => {
    console.error('Error scanning for project notifications:', error)
    process.exit(1)
  })
  .finally(async () => {
    // Close the Bull queue connection
    await projectNotificationQueue.close()
  })
