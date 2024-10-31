/**
 * This script deletes dangling doc and file refs in projects
 */

import minimist from 'minimist'

import mongodb from 'mongodb-legacy'
import { db } from '../app/src/infrastructure/mongodb.js'
import Errors from '../app/src/Features/Errors/Errors.js'
import FileStoreHandler from '../app/src/Features/FileStore/FileStoreHandler.js'
import ProjectEntityMongoUpdateHandler from '../app/src/Features/Project/ProjectEntityMongoUpdateHandler.js'
import { iterablePaths } from '../app/src/Features/Project/IterablePath.js'

const { ObjectId } = mongodb

const OPTIONS = parseArgs()

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['dry-run'],
    default: { 'dry-run': true },
  })
  const dryRun = argv['dry-run']
  const projectIds = argv._
  if (projectIds.length === 0) {
    console.log(`Usage: ${process.argv[1]} [--no-dry-run] PROJECT_ID ...`)
    process.exit(0)
  }
  return { projectIds, dryRun }
}

async function main() {
  const projects = await getProjects()

  for (const project of projects) {
    await processProject(project)
  }

  if (OPTIONS.dryRun) {
    console.log(
      '\nThis was a dry run. Re-run with --no-dry-run to delete broken refs.'
    )
  }
}

async function getProjects() {
  const projectIds = OPTIONS.projectIds.map(id => new ObjectId(id))
  const projects = await db.projects
    .find(
      { _id: { $in: projectIds } },
      { projection: { _id: 1, rootFolder: 1 } }
    )
    .toArray()
  return projects
}

async function processProject(project) {
  console.log(`Processing project ${project._id}`)
  const { docIds, fileIds } = findRefsInFolder(project.rootFolder[0])
  for (const docId of docIds) {
    if (!(await docExists(docId))) {
      await deleteDoc(project._id, docId)
    }
  }
  for (const fileId of fileIds) {
    if (!(await fileExists(project._id, fileId))) {
      await deleteFile(project._id, fileId)
    }
  }
}

function findRefsInFolder(folder) {
  let docIds = folder.docs.map(doc => doc._id)
  let fileIds = folder.fileRefs.map(file => file._id)
  for (const subfolder of iterablePaths(folder, 'folders')) {
    const subrefs = findRefsInFolder(subfolder)
    docIds = docIds.concat(subrefs.docIds)
    fileIds = fileIds.concat(subrefs.fileIds)
  }
  return { docIds, fileIds }
}

async function docExists(docId) {
  const doc = await db.docs.findOne({ _id: docId })
  return doc != null
}

async function fileExists(projectId, fileId) {
  try {
    // Getting the file size to avoid downloading the whole file
    await FileStoreHandler.promises.getFileSize(projectId, fileId)
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      return false
    }
    throw err
  }
  return true
}

async function deleteDoc(projectId, docId) {
  console.log(` * Deleting bad doc ref ${docId}`)
  if (!OPTIONS.dryRun) {
    await ProjectEntityMongoUpdateHandler.promises.deleteEntity(
      projectId,
      docId,
      'doc'
    )
  }
}

async function deleteFile(projectId, fileId) {
  console.log(` * Deleting bad file ref ${fileId}`)
  if (!OPTIONS.dryRun) {
    await ProjectEntityMongoUpdateHandler.promises.deleteEntity(
      projectId,
      fileId,
      'file'
    )
  }
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
