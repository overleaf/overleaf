import minimist from 'minimist'
import ChatApiHandler from '../app/src/Features/Chat/ChatApiHandler.js'
import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.js'
import DocumentUpdaterHandler from '../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'

const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

/**
 * Remove doc comment ranges that are "orphaned" as they do have matching chat
 * threads. This can happen when adding comments and the HTTP request fails, but
 * the ShareJS op succeeded (eventually). See https://github.com/overleaf/internal/issues/3425
 * for more detail.
 */
async function main() {
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

try {
  await main()
  console.log('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
