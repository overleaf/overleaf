import minimist from 'minimist'
import { ObjectId } from '../app/src/infrastructure/mongodb.js'
import ProjectEntityUpdateHandler from '../app/src/Features/Project/ProjectEntityUpdateHandler.js'
import Errors from '../app/src/Features/Errors/Errors.js'

async function main() {
  const argv = minimist(process.argv.slice(2))
  const projectId = argv['project-id']
  const docId = argv['doc-id']
  const userId = argv['user-id']

  if ([projectId, docId, userId].some(it => !it || !ObjectId.isValid(it))) {
    throw new Error(
      'provide a valid object id as --project-id, --doc-id and --user-id'
    )
  }

  console.log(`Converting doc ${projectId}/${docId} as user ${userId}`)
  try {
    await ProjectEntityUpdateHandler.promises.convertDocToFile(
      projectId,
      docId,
      userId,
      null
    )
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      throw new Error('Document not found')
    } else if (err instanceof Errors.DocHasRangesError) {
      throw new Error('Document has comments or tracked changes')
    } else {
      throw err
    }
  }
}

try {
  await main()
  console.log('Done.')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
