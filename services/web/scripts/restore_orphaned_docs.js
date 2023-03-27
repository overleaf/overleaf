const { waitForDb } = require('../app/src/infrastructure/mongodb')
const ProjectEntityRestoreHandler = require('../app/src/Features/Project/ProjectEntityRestoreHandler')
const ProjectEntityHandler = require('../app/src/Features/Project/ProjectEntityHandler')
const DocstoreManager = require('../app/src/Features/Docstore/DocstoreManager')

const ARGV = process.argv.slice(2)
const DEVELOPER_USER_ID = ARGV.shift()
const PROJECT_ID = ARGV.shift()
const DOC_IDS_TO_RESTORE = ARGV

async function main() {
  const allDocs = await DocstoreManager.promises.getAllDocs(PROJECT_ID)
  const docsToRestore = allDocs.filter(doc =>
    DOC_IDS_TO_RESTORE.includes(doc._id)
  )

  const docPaths =
    await ProjectEntityHandler.promises.getAllDocPathsFromProjectById(
      PROJECT_ID
    )

  for (const orphanedDoc of docsToRestore) {
    console.log('Restoring doc: ', orphanedDoc._id)
    if (docPaths[orphanedDoc._id]) {
      console.log(`Doc already exists, skipping ${docPaths[orphanedDoc._id]}`)
      continue
    }
    const newDoc = await ProjectEntityRestoreHandler.promises.restoreDeletedDoc(
      PROJECT_ID,
      orphanedDoc._id,
      `restored-${orphanedDoc._id}-rev-${orphanedDoc.rev}.tex`,
      DEVELOPER_USER_ID
    )
    console.log(newDoc)
  }
}

waitForDb()
  .then(main)
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
