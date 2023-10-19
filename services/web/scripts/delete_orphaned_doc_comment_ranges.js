const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

const minimist = require('minimist')

const { waitForDb } = require('../app/src/infrastructure/mongodb')
const ChatApiHandler = require('../app/src/Features/Chat/ChatApiHandler')
const DocstoreManager = require('../app/src/Features/Docstore/DocstoreManager')
const DocumentUpdaterHandler = require('../app/src/Features/DocumentUpdater/DocumentUpdaterHandler')
const { promiseMapWithLimit } = require('@overleaf/promise-utils')

/**
 * Remove doc comment ranges that are "orphaned" as they do have matching chat
 * threads. This can happen when adding comments and the HTTP request fails, but
 * the ShareJS op succeeded (eventually). See https://github.com/overleaf/internal/issues/3425
 * for more detail.
 */
async function main() {
  await waitForDb()

  const argv = minimist(process.argv.slice(2))
  const { projectId, docId } = argv

  const threads = await ChatApiHandler.promises.getThreads(projectId)
  const threadIds = Object.keys(threads)

  const doc = await DocstoreManager.promises.getDoc(projectId, docId)
  const comments = doc.ranges.comments

  const orphanedCommentIds = comments.filter(comment => {
    const commentThreadId = comment.op.t
    return !threadIds.includes(commentThreadId)
  })

  await promiseMapWithLimit(
    WRITE_CONCURRENCY,
    orphanedCommentIds,
    async comment => {
      await DocumentUpdaterHandler.promises.deleteThread(
        projectId,
        docId,
        comment.op.t
      )
    }
  )

  await DocumentUpdaterHandler.promises.flushDocToMongo(projectId, docId)
}

main()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
