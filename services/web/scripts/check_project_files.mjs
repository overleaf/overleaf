import { scriptRunner } from './lib/ScriptRunner.mjs'
import Path from 'node:path'
import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.mjs'
import DocumentUpdaterHandler from '../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import ProjectGetter from '../app/src/Features/Project/ProjectGetter.mjs'
import ProjectEntityMongoUpdateHandler from '../app/src/Features/Project/ProjectEntityMongoUpdateHandler.mjs'
import { waitForDb, db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import HistoryManager from '../app/src/Features/History/HistoryManager.mjs'
import logger from '@overleaf/logger'
import minimist from 'minimist'

const args = minimist(process.argv.slice(2), {
  boolean: ['verbose', 'fix'],
})

const verbose = args.verbose

if (!verbose) {
  logger.logger.level('error')
}

// no remaining arguments, print usage
if (args._.length === 0) {
  console.log(
    'Usage: node services/web/scripts/check_project_docs.js [--verbose] [--fix] <projectId>...'
  )
  process.exit(1)
}

function logDoc(projectId, path, doc, message = '') {
  console.log(
    'projectId:',
    projectId,
    'doc:',
    JSON.stringify({
      _id: doc._id,
      name: doc.name,
      lines: doc.lines ? doc.lines.join('\n').length : 0,
      rev: doc.rev,
      version: doc.version,
      ranges: typeof doc.ranges,
    }),
    path,
    message
  )
}

function logFile(projectId, path, file, message = '') {
  console.log(
    'projectId:',
    projectId,
    'file:',
    JSON.stringify({
      _id: file._id,
      name: file.name,
      linkedFileData: file.linkedFileData,
      hash: file.hash,
      size: file.size,
    }),
    path,
    message
  )
}

function findPathCounts(projectId, docEntries, fileEntries) {
  const pathCounts = new Map()
  const docPaths = docEntries.map(({ path }) => path)
  const filePaths = fileEntries.map(({ path }) => path)
  const allPaths = docPaths.concat(filePaths)
  for (const path of allPaths) {
    pathCounts.set(path, (pathCounts.get(path) || 0) + 1)
  }
  return pathCounts
}

// copied from services/web/app/src/Features/Project/ProjectDuplicator.mjs
function _getFolderEntries(folder, folderPath = '/') {
  const docEntries = []
  const fileEntries = []
  const docs = folder.docs || []
  const files = folder.fileRefs || []
  const subfolders = folder.folders || []

  for (const doc of docs) {
    if (doc == null || doc._id == null) {
      continue
    }
    const path = Path.join(folderPath, doc.name)
    docEntries.push({ doc, path })
  }

  for (const file of files) {
    if (file == null || file._id == null) {
      continue
    }
    const path = Path.join(folderPath, file.name)
    fileEntries.push({ file, path })
  }

  for (const subfolder of subfolders) {
    if (subfolder == null || subfolder._id == null) {
      continue
    }
    const subfolderPath = Path.join(folderPath, subfolder.name)
    const subfolderEntries = _getFolderEntries(subfolder, subfolderPath)
    for (const docEntry of subfolderEntries.docEntries) {
      docEntries.push(docEntry)
    }
    for (const fileEntry of subfolderEntries.fileEntries) {
      fileEntries.push(fileEntry)
    }
  }
  return { docEntries, fileEntries }
}

async function getDocsInMongo(projectId) {
  return await db.docs
    .find({ project_id: new ObjectId(projectId), deleted: { $ne: true } })
    .toArray()
}

function getDocIdsInFileTree(docEntries) {
  return docEntries.map(({ doc }) => doc._id.toString())
}

function findMissingDocs(docsInMongo, docIdsInFileTree) {
  const missingDocs = []
  for (const doc of docsInMongo) {
    const docId = doc._id.toString()
    if (!docIdsInFileTree.includes(docId)) {
      console.log(`Found doc in docstore not in project filetree:`, docId)
      missingDocs.push(doc)
    }
  }
  return missingDocs
}

async function createRecoveryFolder(projectId) {
  const recoveryFolder = `recovered-${Date.now()}`
  const { folder } = await ProjectEntityMongoUpdateHandler.promises.mkdirp(
    new ObjectId(projectId),
    recoveryFolder,
    null // unset lastUpdatedBy
  )
  console.log('Created recovery folder:', folder._id.toString())
  return folder
}

async function restoreMissingDocs(projectId, folder, missingDocs) {
  for (const doc of missingDocs) {
    doc.name = doc.name || `unknown-file-${doc._id.toString()}`
    try {
      await ProjectEntityMongoUpdateHandler.promises.addDoc(
        new ObjectId(projectId),
        folder._id,
        doc,
        null // unset lastUpdatedBy
      )
      console.log('Restored doc to filetree:', doc._id.toString())
    } catch (err) {
      console.log(`Error adding doc to filetree:`, err)
    }
  }
}

async function checkProject(projectId) {
  try {
    await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)
  } catch (err) {
    console.log(`Error flushing project ${projectId} to mongo: ${err}`)
  }
  const project = await ProjectGetter.promises.getProject(projectId, {
    rootFolder: true,
    rootDoc_id: true,
  })
  if (verbose) {
    console.log(`project: ${JSON.stringify(project)}`)
  }
  const { docEntries, fileEntries } = _getFolderEntries(project.rootFolder[0])
  console.log(
    `Found ${docEntries.length} docEntries and ${fileEntries.length} fileEntries`
  )
  const pathCounts = findPathCounts(projectId, docEntries, fileEntries)

  for (const [path, count] of pathCounts) {
    if (count > 1) {
      console.log(`Found duplicate path: ${path}`)
    }
  }

  let errors = 0
  for (const { doc, path } of docEntries) {
    try {
      const { lines, rev, version, ranges } =
        await DocstoreManager.promises.getDoc(projectId, doc._id)
      if (!lines) {
        throw new Error('no doclines')
      }
      if (pathCounts.get(path) > 1) {
        logDoc(
          projectId,
          path,
          { ...doc, lines, rev, version, ranges },
          'duplicate path'
        )
        errors++
      } else if (verbose) {
        logDoc(projectId, path, { ...doc, lines, rev, version, ranges })
      }
    } catch (err) {
      logDoc(projectId, path, doc, err)
      errors++
    }
  }
  for (const { file, path } of fileEntries) {
    try {
      const { contentLength: fileSize } =
        await HistoryManager.promises.requestBlobWithProjectId(
          projectId,
          file.hash,
          'HEAD'
        )
      if (pathCounts.get(path) > 1) {
        logFile(projectId, path, { ...file, fileSize }, 'duplicate path')
        errors++
      } else if (verbose) {
        logFile(projectId, path, { ...file, fileSize })
      }
    } catch (err) {
      logFile(projectId, path, file, err)
      errors++
    }
  }

  // now look for docs in the docstore that are not in the project filetree
  const docsInMongo = await getDocsInMongo(projectId)
  const docIdsInFileTree = getDocIdsInFileTree(docEntries)
  const missingDocs = findMissingDocs(docsInMongo, docIdsInFileTree)

  if (args.fix && missingDocs.length > 0) {
    console.log('Restoring missing docs to filetree...')
    const folder = await createRecoveryFolder(projectId)
    await restoreMissingDocs(projectId, folder, missingDocs)
  }

  if (errors > 0) {
    console.log(`Errors found in project: ${projectId}`)
  } else {
    console.log(`No errors found in project: ${projectId}`)
  }
}

async function main() {
  await waitForDb()
  for (const projectId of args._) {
    await checkProject(projectId)
  }
}

scriptRunner(main, args)
  .then(() => {
    console.log('DONE')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
