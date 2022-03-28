const minimist = require('minimist')
const { waitForDb, ObjectId } = require('../app/src/infrastructure/mongodb')
const ProjectEntityUpdateHandler = require('../app/src/Features/Project/ProjectEntityUpdateHandler')
const Errors = require('../app/src/Features/Errors/Errors')

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
  await waitForDb()
  try {
    await ProjectEntityUpdateHandler.promises.convertDocToFile(
      projectId,
      docId,
      userId
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

main()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
