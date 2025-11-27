// @ts-check

import minimist from 'minimist'
import ChatApiHandler from '../app/src/Features/Chat/ChatApiHandler.mjs'
import DocumentUpdaterHandler from '../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.mjs'
import HistoryManager from '../app/src/Features/History/HistoryManager.mjs'
import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'

const OPTS = parseArgs()

function usage() {
  console.error(
    'Usage: node delete_dangling_comments.mjs [--commit] PROJECT_ID...'
  )
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit'],
  })
  if (args._.length === 0) {
    usage()
    process.exit(0)
  }
  return {
    projectIds: args._,
    commit: args.commit,
  }
}

async function processProject(projectId) {
  console.log(`Processing project ${projectId}...`)
  await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(projectId)
  const docRanges = await DocstoreManager.promises.getAllRanges(projectId)
  const threads = await ChatApiHandler.promises.getThreads(projectId)
  const threadIds = new Set(Object.keys(threads))
  let commentsDeleted = 0
  for (const doc of docRanges) {
    const commentsDeletedInDoc = await processDoc(projectId, doc, threadIds)
    commentsDeleted += commentsDeletedInDoc
  }
  if (OPTS.commit) {
    console.log(`${commentsDeleted} comments deleted`)
    if (commentsDeleted > 0) {
      console.log(`Resyncing history for project ${projectId}`)
      await HistoryManager.promises.resyncProject(projectId)
    }
  }
}

async function processDoc(projectId, doc, threadIds) {
  let commentsDeleted = 0
  for (const comment of doc.ranges?.comments ?? []) {
    const threadId = comment.op.t
    if (!threadIds.has(threadId)) {
      if (OPTS.commit) {
        console.log(`Deleting dangling comment ${comment.op.t}...`)
        await deleteComment(doc._id, threadId)
        commentsDeleted += 1
      } else {
        console.log(`Would delete dangling comment ${comment.op.t}...`)
      }
    }
  }
  return commentsDeleted
}

async function deleteComment(docId, threadId) {
  await db.docs.updateOne(
    { _id: new ObjectId(docId) },
    {
      $pull: { 'ranges.comments': { 'op.t': new ObjectId(threadId) } },
    }
  )
}

// Main loop
for (const projectId of OPTS.projectIds) {
  await processProject(projectId)
}
if (!OPTS.commit) {
  console.log('This was a dry run. Rerun with --commit to apply changes')
}
process.exit(0)
