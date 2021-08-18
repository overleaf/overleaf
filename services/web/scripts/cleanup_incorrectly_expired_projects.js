/**
 * This script cleans up active projects that were expired. It's meant to be used once.
 *
 * See https://github.com/overleaf/internal/issues/4532
 */
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const Errors = require('../app/src/Features/Errors/Errors')
const FileStoreHandler = require('../app/src/Features/FileStore/FileStoreHandler')
const ProjectEntityMongoUpdateHandler = require('../app/src/Features/Project/ProjectEntityMongoUpdateHandler')
const { batchedUpdate } = require('./helpers/batchedUpdate')

const DRY_RUN = process.env.DRY_RUN !== 'false'

waitForDb()
  .then(main)
  .then(() => {
    process.exitCode = 0
  })
  .catch(error => {
    console.error({ error })
    process.exitCode = 1
  })
  .finally(() => {
    process.exit()
  })

async function main() {
  await batchedUpdate(
    'deletedProjects',
    { project: null },
    processDeletedProjects,
    {
      'deleterData.deletedProjectId': 1,
    }
  )
  if (DRY_RUN) {
    console.log(
      '\nThis was a dry run. Re-run with DRY_RUN=false to delete broken refs and projects.'
    )
  }
}

async function processDeletedProjects(collection, deletedProjects) {
  const projectIds = deletedProjects.map(x => x.deleterData.deletedProjectId)
  const activeProjects = await db.projects
    .find(
      { _id: { $in: projectIds } },
      { projection: { _id: 1, rootFolder: 1 } }
    )
    .toArray()
  for (const activeProject of activeProjects) {
    await cleanupProject(activeProject)
  }
}

async function cleanupProject(project) {
  const { docIds, fileIds } = findRefsInFolder(project.rootFolder[0])
  const badDocIds = []
  const badFileIds = []
  for (const docId of docIds) {
    if (!(await docExists(docId))) {
      badDocIds.push(docId)
    }
  }
  for (const fileId of fileIds) {
    if (!(await fileExists(project._id, fileId))) {
      badFileIds.push(fileId)
    }
  }

  if (badDocIds.length === 0 && badFileIds.length === 0) {
    return
  }

  if (
    badDocIds.length === docIds.length &&
    badFileIds.length === fileIds.length
  ) {
    console.log(`Deleting project ${project._id}. All refs are bad.`)
    if (!DRY_RUN) {
      await db.projects.removeOne({ _id: project._id })
    }
    return
  }

  console.log(`Cleaning project ${project._id}:`)
  for (const docId of badDocIds) {
    console.log(` * Deleting bad doc ref ${docId}`)
    if (!DRY_RUN) {
      await ProjectEntityMongoUpdateHandler.promises.deleteEntity(
        project._id,
        docId,
        'doc'
      )
    }
  }

  for (const fileId of badFileIds) {
    console.log(` * Deleting bad file ref ${fileId}`)
    if (!DRY_RUN) {
      await ProjectEntityMongoUpdateHandler.promises.deleteEntity(
        project._id,
        fileId,
        'file'
      )
    }
  }
}

function findRefsInFolder(folder) {
  let docIds = folder.docs.map(doc => doc._id)
  let fileIds = folder.fileRefs.map(file => file._id)
  for (const subfolder of folder.folders) {
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
