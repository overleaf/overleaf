// @ts-check

import minimist from 'minimist'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.js'
import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.js'
import { NotFoundError } from '../app/src/Features/Errors/Errors.js'

const OPTS = parseArgs()

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: ['min-project-id', 'max-project-id', 'project-modified-since'],
    boolean: ['help'],
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  return {
    minProjectId: args['min-project-id'] ?? null,
    maxProjectId: args['max-project-id'] ?? null,
    projectModifiedSince: args['project-modified-since']
      ? new Date(args['project-modified-since'])
      : null,
  }
}

function usage() {
  console.log(`Usage: find_dangling_comments.mjs [OPTS]

Options:

    --min-project-id          Start scanning at this project id
    --max-project-id          Stop scanning at this project id
    --project-modified-since  Only consider projects that were modified after the given date
                              Example: 2020-01-01`)
}

async function main() {
  let projectsProcessed = 0
  let projectsFound = 0
  for await (const projectId of fetchProjectIds()) {
    projectsProcessed += 1
    const threadIds = await fetchThreadIds(projectId)
    const danglingThreadIds = await findDanglingThreadIds(projectId, threadIds)
    if (danglingThreadIds.length > 0) {
      console.log(
        `Project ${projectId} has dangling threads: ${danglingThreadIds.join(', ')}`
      )
      projectsFound += 1
    }
    if (projectsProcessed % 1000 === 0) {
      console.log(
        `${projectsProcessed} projects processed - Last project: ${projectId}`
      )
    }
  }
  console.log(`${projectsFound} projects with dangling comments found`)
}

function fetchProjectIds() {
  const clauses = []

  if (OPTS.minProjectId != null) {
    clauses.push({ project_id: { $gte: new ObjectId(OPTS.minProjectId) } })
  }

  if (OPTS.maxProjectId != null) {
    clauses.push({ project_id: { $lte: new ObjectId(OPTS.maxProjectId) } })
  }

  if (OPTS.projectModifiedSince) {
    clauses.push({ lastUpdated: { $gte: OPTS.projectModifiedSince } })
  }

  const query = clauses.length > 0 ? { $and: clauses } : {}
  return db.projects
    .find(query, {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    })
    .map(x => x._id.toString())
}

async function fetchThreadIds(projectId) {
  const docs = db.docs.find(
    {
      project_id: new ObjectId(projectId),
      deleted: { $ne: true },
      $or: [{ 'ranges.comments.0': { $exists: true } }, { inS3: true }],
    },
    {
      projection: { 'ranges.comments': 1, inS3: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )

  const threadIds = new Set()
  for await (const doc of docs) {
    let comments = []
    if (doc.inS3) {
      try {
        const archivedDoc = await DocstoreManager.promises.getDoc(
          projectId,
          doc._id,
          { peek: true }
        )
        comments = archivedDoc.ranges?.comments ?? []
      } catch (err) {
        if (err instanceof NotFoundError) {
          console.warn(`Doc ${doc._id} in project ${projectId} not found`)
        } else {
          throw err
        }
      }
    } else {
      comments = doc.ranges?.comments
    }

    for (const comment of comments) {
      threadIds.add(comment.op.t.toString())
    }
  }

  return threadIds
}

/**
 * @param {string} projectId
 * @param {Set<string>} threadIds
 */
async function findDanglingThreadIds(projectId, threadIds) {
  const rooms = await db.rooms.find(
    { project_id: projectId, thread_id: { $exists: true } },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
  const existingThreadIds = new Set()
  for await (const room of rooms) {
    existingThreadIds.add(room.thread_id.toString())
  }

  const danglingThreadIds = []
  for (const threadId of threadIds) {
    if (!existingThreadIds.has(threadId)) {
      danglingThreadIds.push(threadId)
    }
  }

  return danglingThreadIds
}

try {
  await main()
  process.exit(0)
} catch (err) {
  console.error(err)
  process.exit(1)
}
