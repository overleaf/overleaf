const { ObjectId } = require('mongodb')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')

async function main() {
  const { projectId, mongoPath } = parseArgs()
  await waitForDb()
  const pathSegments = mongoPath.split('.')
  const lastPathSegment = pathSegments[pathSegments.length - 1]

  let modifiedCount
  if (mongoPath === 'rootFolder.0') {
    modifiedCount = await fixRootFolder(projectId)
  } else if (endsWithNumber(mongoPath)) {
    modifiedCount = await removeNullFolders(projectId, parentPath(mongoPath))
  } else if (['docs', 'folders', 'fileRefs'].includes(lastPathSegment)) {
    modifiedCount = await ensureElementIsArray(projectId, mongoPath)
  } else {
    console.error(`Unexpected mongo path: ${mongoPath}`)
    process.exit(1)
  }

  console.log(`${modifiedCount} project(s) modified`)
  process.exit(0)
}

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length !== 2) {
    console.error('Usage: fix_malformed_filetree.js PROJECT_ID MONGO_PATH')
    process.exit(1)
  }
  const [projectId, mongoPath] = args
  return { projectId: ObjectId(projectId), mongoPath }
}

function endsWithNumber(path) {
  return /\.\d+$/.test(path)
}

function parentPath(path) {
  return path.slice(0, path.lastIndexOf('.'))
}

/**
 * If the root folder structure is missing, set it up
 */
async function fixRootFolder(projectId) {
  const result = await db.projects.updateOne(
    { _id: projectId, rootFolder: [] },
    {
      $set: {
        rootFolder: [
          {
            _id: ObjectId(),
            name: 'rootFolder',
            folders: [],
            docs: [],
            fileRefs: [],
          },
        ],
      },
    }
  )
  return result.modifiedCount
}

/**
 * Remove all null entries from the given folders array
 */
async function removeNullFolders(projectId, foldersPath) {
  const result = await db.projects.updateOne(
    { _id: projectId, [foldersPath]: { $exists: true } },
    { $pull: { [foldersPath]: null } }
  )
  return result.modifiedCount
}

/**
 * If the element at the given path is not an array, set it to an empty array
 */
async function ensureElementIsArray(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: projectId, [path]: { $not: { $type: 'array' } } },
    { $set: { [path]: [] } }
  )
  return result.modifiedCount
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
