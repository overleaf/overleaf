const { ObjectId } = require('mongodb')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const DocumentUpdaterHandler = require('../app/src/Features/DocumentUpdater/DocumentUpdaterHandler')

const PROJECT_ID = process.env.PROJECT_ID
const DOC_ID = process.env.DOC_ID
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const DRY_RUN = process.env.DRY_RUN !== 'false'

console.log({
  PROJECT_ID,
  DOC_ID,
  VERBOSE_LOGGING,
  DRY_RUN,
})

async function main() {
  await waitForDb()

  const { lines, version, ranges } = await getDocument()
  const size = lines.reduce((size, line) => size + line.length + 1, 0)

  console.log('doc stats:', {
    lineCount: lines.length,
    size,
    version,
  })
  if (!DRY_RUN) {
    console.log(`updating doc ${DOC_ID} in mongo for project ${PROJECT_ID}`)
    const result = await db.docs.updateOne(
      { _id: ObjectId(DOC_ID), project_id: ObjectId(PROJECT_ID) },
      {
        $set: { lines, version, ranges },
        $inc: { rev: 1 }, // maintain same behaviour as Docstore upsertIntoDocCollection
        $unset: {
          inS3: true,
        },
      }
    )
    console.log('mongo result', result)
    if (
      result.matchedCount !== 1 ||
      result.modifiedCount !== 1 ||
      !result.acknowledged
    ) {
      throw new Error('unexpected result from mongo update')
    }
    console.log(`deleting doc ${DOC_ID} from redis for project ${PROJECT_ID}`)
    await DocumentUpdaterHandler.promises.deleteDoc(PROJECT_ID, DOC_ID, true)
  }
}

function getDocument() {
  return new Promise((resolve, reject) => {
    DocumentUpdaterHandler.getDocument(
      PROJECT_ID,
      DOC_ID,
      -1,
      (error, lines, version, ranges) => {
        if (error) {
          reject(error)
        } else {
          resolve({ lines, version, ranges })
        }
      }
    )
  })
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
