// @ts-check

import minimist from 'minimist'
import process from 'node:process'
import ChatApiHandler from '../app/src/Features/Chat/ChatApiHandler.mjs'
import DocumentUpdaterHandler from '../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.mjs'
import HistoryManager from '../app/src/Features/History/HistoryManager.mjs'
import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'

const OPTS = parseArgs()

function usage() {
  console.error('Attach dangling threads to the beginning of a document')
  console.error('')
  console.error('Usage: node attach_dangling_comments_to_doc.mjs')
  console.error('   --project   PROJECT_ID')
  console.error('   --doc       DOC_ID')
  console.error('   [--commit]')
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit'],
    string: ['project', 'doc'],
  })
  const projectId = args.project
  const docId = args.doc
  if (!projectId || !docId) {
    usage()
    process.exit(0)
  }
  return { projectId, docId, commit: args.commit }
}

/**
 * @typedef {{ id: string, content: string, timestamp: number, user_id: string }} Message
 * @typedef {{ id: string, messages: Message[] }} Thread
 */

/**
 * @param {string} projectId
 * @returns {Promise<Thread[]>}
 */
async function getDanglingThreads(projectId) {
  const docRanges = await DocstoreManager.promises.getAllRanges(projectId)
  const threads = await ChatApiHandler.promises.getThreads(projectId)

  const threadsInDoc = new Set()
  for (const doc of docRanges) {
    for (const comment of doc.ranges?.comments ?? []) {
      threadsInDoc.add(comment.op.t)
    }
  }

  const danglingThreads = Object.keys(threads)
    .filter(threadId => !threadsInDoc.has(threadId))
    .map(id => ({ ...threads[id], id }))

  console.log(`Found:`)
  console.log(`  - ${Object.keys(threads).length} threads`)
  console.log(`  - ${threadsInDoc.size} threads in docRanges`)
  console.log(`  - ${danglingThreads.length} dangling threads`)

  return danglingThreads
}

const ensureDocExists = async (projectId, docId) => {
  const doc = await DocstoreManager.promises.getDoc(projectId, docId)
  if (!doc) {
    console.error(`Document ${docId} not found`)
    process.exit(1)
  }
}

/**
 * @param {Thread[]} threads
 */
const ensureThreadsHaveMessages = async threads => {
  const threadsWithoutMessages = threads.filter(
    thread => !thread.messages || thread.messages.length === 0
  )
  if (threadsWithoutMessages.length > 0) {
    console.error(`The following threads have no messages:`)
    console.error(threadsWithoutMessages.join(','))
    process.exit(1)
  }
}

/**
 * @param {string} projectId
 * @param {string} docId
 */
async function processProject(projectId, docId) {
  console.log(`Processing project ${projectId}`)

  await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(projectId)

  const danglingThreads = await getDanglingThreads(projectId)

  await ensureDocExists(projectId, docId)
  await ensureThreadsHaveMessages(danglingThreads)

  for (const thread of danglingThreads) {
    const firstMessage = thread.messages[0]
    if (!firstMessage) {
      console.error(`Thread ${thread.id} has no messages`)
      continue
    }
    const rangeComment = newRangeComment(thread, firstMessage)

    console.log(`Attaching thread ${thread.id} to doc ${docId}`)

    if (OPTS.commit) {
      await db.docs.updateOne(
        { _id: new ObjectId(docId) },
        { $push: { 'ranges.comments': rangeComment } }
      )
    }
  }

  if (OPTS.commit) {
    console.log(`Resyncing history for project ${projectId}`)
    await HistoryManager.promises.resyncProject(projectId)
  }
}

/**
 * @param {Thread} thread
 * @param {Message} message
 */
const newRangeComment = (thread, message) => ({
  id: new ObjectId(thread.id),
  op: { t: new ObjectId(thread.id), p: 0, c: '' },
  metadata: {
    user_id: new ObjectId(message.user_id),
    ts: new Date(message.timestamp),
  },
})

await processProject(OPTS.projectId, OPTS.docId)

if (!OPTS.commit) {
  console.log('This was a dry run. Rerun with --commit to apply changes')
}
process.exit(0)
