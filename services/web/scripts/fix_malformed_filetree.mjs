/**
 * This script fixes problems found by the find_malformed_filetrees.js script.
 *
 * The script takes two arguments: the project id and the problemtatic path.
 * This is the output format of each line in the find_malformed_filetrees.js
 * script.
 */
import mongodb from 'mongodb-legacy'
import { db } from '../app/src/infrastructure/mongodb.js'
import ProjectLocator from '../app/src/Features/Project/ProjectLocator.js'

const { ObjectId } = mongodb

async function main() {
  const { projectId, mongoPath } = parseArgs()
  let modifiedCount
  if (isRootFolder(mongoPath)) {
    modifiedCount = await fixRootFolder(projectId)
  } else if (isArrayElement(mongoPath)) {
    modifiedCount = await removeNulls(projectId, parentPath(mongoPath))
  } else if (isArray(mongoPath)) {
    modifiedCount = await fixArray(projectId, mongoPath)
  } else if (isFolderId(mongoPath)) {
    modifiedCount = await fixFolderId(projectId, mongoPath)
  } else if (isDocOrFileId(mongoPath)) {
    modifiedCount = await removeElementsWithoutIds(
      projectId,
      parentPath(parentPath(mongoPath))
    )
  } else if (isName(mongoPath)) {
    modifiedCount = await fixName(projectId, mongoPath)
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
  return { projectId: new ObjectId(projectId), mongoPath }
}

function isRootFolder(path) {
  return path === 'rootFolder.0'
}

function isArray(path) {
  return /\.(docs|folders|fileRefs)$/.test(path)
}

function isArrayElement(path) {
  return /\.\d+$/.test(path)
}

function isFolderId(path) {
  return /\.folders\.\d+\._id$/.test(path)
}

function isDocOrFileId(path) {
  return /\.(docs|fileRefs)\.\d+\._id$/.test(path)
}

function isName(path) {
  return /\.name$/.test(path)
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
            _id: new ObjectId(),
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
 * Remove all nulls from the given docs/files/folders array
 */
async function removeNulls(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: projectId, [path]: { $type: 'array' } },
    { $pull: { [path]: null } }
  )
  return result.modifiedCount
}

/**
 * If the element at the given path is not an array, set it to an empty array
 */
async function fixArray(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: projectId, [path]: { $not: { $type: 'array' } } },
    { $set: { [path]: [] } }
  )
  return result.modifiedCount
}

/**
 * Generate a missing id for a folder
 */
async function fixFolderId(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: projectId, [path]: { $exists: false } },
    { $set: { [path]: new ObjectId() } }
  )
  return result.modifiedCount
}

/**
 * Remove elements that don't have ids in the array at the given path
 */
async function removeElementsWithoutIds(projectId, path) {
  const result = await db.projects.updateOne(
    { _id: projectId, [path]: { $type: 'array' } },
    { $pull: { [path]: { _id: null } } }
  )
  return result.modifiedCount
}

/**
 * Give a name to a file/doc/folder that doesn't have one
 */
async function fixName(projectId, path) {
  const project = await db.projects.findOne(
    { _id: projectId },
    { projection: { rootFolder: 1 } }
  )
  const arrayPath = parentPath(parentPath(path))
  const array = ProjectLocator.findElementByMongoPath(project, arrayPath)
  const existingNames = new Set(array.map(x => x.name))
  const name = findUniqueName(existingNames)
  const result = await db.projects.updateOne(
    { _id: projectId, [path]: { $in: [null, ''] } },
    { $set: { [path]: name } }
  )
  return result.modifiedCount
}

function findUniqueName(existingFilenames) {
  let index = 0
  let filename = 'untitled'
  while (existingFilenames.has(filename)) {
    index += 1
    filename = `untitled-${index}`
  }
  return filename
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
