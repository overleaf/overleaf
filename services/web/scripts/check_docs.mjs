// @ts-check

import minimist from 'minimist'
import PQueue from 'p-queue'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.mjs'
import { NotFoundError } from '../app/src/Features/Errors/Errors.js'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const OPTS = parseArgs()

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: ['min-project-id', 'max-project-id', 'project-modified-since'],
    boolean: ['help', 'dangling-comments', 'tracked-changes', 'any-comments'],
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  const danglingComments = Boolean(args['dangling-comments'])
  const trackedChanges = Boolean(args['tracked-changes'])
  const anyComments = Boolean(args['any-comments'])
  if (!danglingComments && !trackedChanges && !anyComments) {
    console.log(
      'At least one of --dangling-comments, --tracked-changes, or --any-comments must be enabled'
    )
    process.exit(1)
  }

  return {
    minProjectId: args['min-project-id'] ?? null,
    maxProjectId: args['max-project-id'] ?? null,
    projectModifiedSince: args['project-modified-since']
      ? new Date(args['project-modified-since'])
      : null,
    danglingComments,
    trackedChanges,
    anyComments,
    concurrency: parseInt(args.concurrency ?? '1', 10),
  }
}

function usage() {
  console.log(`Usage: check_docs.mjs [OPTS]

Options:

    --min-project-id          Start scanning at this project id
    --max-project-id          Stop scanning at this project id
    --project-modified-since  Only consider projects that were modified after the given date
                              Example: 2020-01-01
    --dangling-comments       Report projects with dangling comments
    --tracked-changes         Report projects with tracked changes
    --any-comments            Report projects with any comments
    --concurrency             How many projects can be processed in parallel
    `)
}

async function main() {
  const queue = new PQueue({ concurrency: OPTS.concurrency })
  let projectsProcessed = 0
  let danglingCommentsFound = 0
  let trackedChangesFound = 0
  let anyCommentsFound = 0

  for await (const projectId of getProjectIds()) {
    await queue.onEmpty()
    queue.add(async () => {
      const docs = await getDocs(projectId)

      if (OPTS.danglingComments) {
        const danglingThreadIds = await findDanglingThreadIds(projectId, docs)
        if (danglingThreadIds.length > 0) {
          console.log(
            `Project ${projectId} has dangling threads: ${danglingThreadIds.join(', ')}`
          )
          danglingCommentsFound += 1
        }
      }

      if (OPTS.trackedChanges) {
        if (docsHaveTrackedChanges(docs)) {
          console.log(`Project ${projectId} has tracked changes`)
          trackedChangesFound += 1
        }
      }

      if (OPTS.anyComments) {
        if (docsHaveAnyComments(docs)) {
          console.log(`Project ${projectId} has comments`)
          anyCommentsFound += 1
        }
      }

      projectsProcessed += 1
      if (projectsProcessed % 100000 === 0) {
        console.log(
          `${projectsProcessed} projects processed - Last project: ${projectId}`
        )
      }
    })
  }
  await queue.onIdle()

  if (OPTS.danglingComments) {
    console.log(
      `${danglingCommentsFound} projects with dangling comments found`
    )
  }

  if (OPTS.trackedChanges) {
    console.log(`${trackedChangesFound} projects with tracked changes found`)
  }

  if (OPTS.anyComments) {
    console.log(`${anyCommentsFound} projects with any comments found`)
  }
}

function getProjectIds() {
  const clauses = []

  if (OPTS.minProjectId != null) {
    clauses.push({ _id: { $gte: new ObjectId(OPTS.minProjectId) } })
  }

  if (OPTS.maxProjectId != null) {
    clauses.push({ _id: { $lte: new ObjectId(OPTS.maxProjectId) } })
  }

  if (OPTS.projectModifiedSince) {
    clauses.push({ lastUpdated: { $gte: OPTS.projectModifiedSince } })
  }

  const query = clauses.length > 0 ? { $and: clauses } : {}
  return db.projects
    .find(query, {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
      sort: { _id: 1 },
    })
    .map(x => x._id.toString())
}

async function getDocs(projectId) {
  const mongoDocs = db.docs.find(
    {
      project_id: new ObjectId(projectId),
      deleted: { $ne: true },
    },
    {
      projection: { ranges: 1, inS3: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )

  const docs = []
  for await (const mongoDoc of mongoDocs) {
    if (mongoDoc.inS3) {
      try {
        const archivedDoc = await DocstoreManager.promises.getDoc(
          projectId,
          mongoDoc._id,
          { peek: true }
        )
        docs.push({
          id: mongoDoc._id.toString(),
          ranges: archivedDoc.ranges,
        })
      } catch (err) {
        if (err instanceof NotFoundError) {
          console.warn(`Doc ${mongoDoc._id} in project ${projectId} not found`)
        } else {
          throw err
        }
      }
    } else {
      docs.push({
        id: mongoDoc._id.toString(),
        ranges: mongoDoc.ranges,
      })
    }
  }

  return docs
}

async function findDanglingThreadIds(projectId, docs) {
  const threadIds = new Set()
  for (const doc of docs) {
    const comments = doc.ranges?.comments ?? []
    for (const comment of comments) {
      threadIds.add(comment.op.t.toString())
    }
  }

  if (threadIds.size === 0) {
    return []
  }

  const rooms = db.rooms.find(
    { project_id: new ObjectId(projectId), thread_id: { $exists: true } },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
  for await (const room of rooms) {
    threadIds.delete(room.thread_id.toString())
    if (threadIds.size === 0) {
      break
    }
  }

  return Array.from(threadIds)
}

function docsHaveTrackedChanges(docs) {
  for (const doc of docs) {
    const changes = doc.ranges?.changes ?? []
    if (changes.length > 0) {
      return true
    }
  }
  return false
}

function docsHaveAnyComments(docs) {
  for (const doc of docs) {
    const comments = doc.ranges?.comments ?? []
    if (comments.length > 0) {
      return true
    }
  }
  return false
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (err) {
  console.error(err)
  process.exit(1)
}
