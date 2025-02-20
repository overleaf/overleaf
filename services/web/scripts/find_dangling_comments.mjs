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
    string: ['min-project-id', 'max-project-id'],
    boolean: ['help'],
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  return {
    minProjectId: args['min-project-id'] ?? null,
    maxProjectId: args['max-project-id'] ?? null,
  }
}

function usage() {
  console.log(`Usage: find_dangling_comments.mjs [OPTS]

Options:

    --min-project-id    Start scanning at this project id
    --max-project-id    Stop scanning at this project id`)
}

async function main() {
  let projectsProcessed = 0
  let projectsFound = 0
  for await (const { projectId, threadIds } of fetchThreadIdsByProject()) {
    projectsProcessed += 1
    const danglingThreadIds = await findDanglingThreadIds(projectId, threadIds)
    if (danglingThreadIds.length > 0) {
      console.log(
        `Project ${projectId} has dangling threads: ${danglingThreadIds.join(', ')}`
      )
      projectsFound += 1
    }
    if (projectsProcessed % 10000 === 0) {
      console.log(
        `${projectsProcessed} projects processed - Last project: ${projectId}`
      )
    }
  }
  console.log(`${projectsFound} projects with dangling comments found`)
}

async function* fetchThreadIdsByProject() {
  const clauses = []
  clauses.push({
    deleted: { $ne: true },
    $or: [{ 'ranges.comments.0': { $exists: true } }, { inS3: true }],
  })
  if (OPTS.minProjectId != null) {
    clauses.push({ project_id: { $gte: new ObjectId(OPTS.minProjectId) } })
  }
  if (OPTS.maxProjectId != null) {
    clauses.push({ project_id: { $lte: new ObjectId(OPTS.maxProjectId) } })
  }
  const docs = db.docs.find(
    { $and: clauses },
    {
      sort: { project_id: 1 },
      projection: { project_id: 1, 'ranges.comments': 1, inS3: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
  let projectId
  let threadIds = new Set()
  for await (const doc of docs) {
    if (projectId !== doc.project_id) {
      yield { projectId, threadIds }
      projectId = doc.project_id
      threadIds = new Set()
    }

    projectId = doc.project_id

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
  yield { projectId, threadIds }
} /**
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
