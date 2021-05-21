const { waitForDb } = require('../app/src/infrastructure/mongodb')
const ProjectEntityUpdateHandler = require('../app/src/Features/Project/ProjectEntityUpdateHandler')
const ProjectEntityHandler = require('../app/src/Features/Project/ProjectEntityHandler')
const DocstoreManager = require('../app/src/Features/Docstore/DocstoreManager')
const Path = require('path')

const ARGV = process.argv.slice(2)
const DEVELOPER_USER_ID = ARGV.shift()
const PROJECT_ID = ARGV.shift()
const FILE_NAMES_TO_RESTORE = ARGV

async function main() {
  const deletedDocs = await DocstoreManager.promises.getAllDeletedDocs(
    PROJECT_ID
  )
  const docsToRestore = deletedDocs.filter(doc =>
    FILE_NAMES_TO_RESTORE.includes(doc.name)
  )
  for (const deletedDoc of docsToRestore) {
    const doc = await new Promise((resolve, reject) => {
      ProjectEntityHandler.getDoc(
        PROJECT_ID,
        deletedDoc._id,
        {
          include_deleted: true,
        },
        (err, lines, rev, version, ranges) => {
          if (err) return reject(err)
          resolve({ lines, ranges })
        }
      )
    })

    const formattedTimestamp = new Date()
      .toISOString()
      .replace('T', '-')
      .replace(/[^0-9-]/g, '')
    const extension = Path.extname(deletedDoc.name)
    const basename = Path.basename(deletedDoc.name, extension)
    const deletedDocName = `${basename}-${formattedTimestamp}${extension}`
    const newDoc = await new Promise((resolve, reject) => {
      ProjectEntityUpdateHandler.addDocWithRanges(
        PROJECT_ID,
        null,
        `${deletedDocName}`,
        doc.lines,
        doc.ranges,
        DEVELOPER_USER_ID,
        (err, doc, folderId) => {
          if (err) return reject(err)
          resolve({ doc, folderId })
        }
      )
    })
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
