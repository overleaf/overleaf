// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import ProjectEntityHandler from './ProjectEntityHandler.mjs'
import ProjectEntityUpdateHandler from './ProjectEntityUpdateHandler.mjs'
import ProjectGetter from './ProjectGetter.mjs'
import DocumentHelper from '../Documents/DocumentHelper.mjs'
import Path from 'node:path'
import fs from 'node:fs'
import pLimit from 'p-limit'
import globby from 'globby'
import { callbackify, callbackifyMultiResult } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import { BackgroundTaskTracker } from '../../infrastructure/GracefulShutdown.mjs'

const rootDocResets = new BackgroundTaskTracker('root doc resets')

function setRootDocAutomaticallyInBackground(projectId) {
  rootDocResets.add()
  setTimeout(async () => {
    try {
      await ProjectRootDocManager.promises.setRootDocAutomatically(projectId)
    } catch (err) {
      logger.warn({ err }, 'failed to set root doc automatically in background')
    } finally {
      rootDocResets.done()
    }
  }, 30 * 1000)
}

async function setRootDocAutomatically(projectId) {
  const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)

  for (const [path, doc] of Object.entries(docs)) {
    if (
      ProjectEntityUpdateHandler.isPathValidForRootDoc(path) &&
      DocumentHelper.contentHasDocumentclass(doc.lines) &&
      doc._id
    ) {
      return await ProjectEntityUpdateHandler.promises.setRootDoc(
        projectId,
        doc._id
      )
    }
  }
}

async function findRootDocFileFromDirectory(directoryPath) {
  const unsortedFiles = await globby(['**/*.{tex,Rtex,Rnw}'], {
    cwd: directoryPath,
    followSymlinkedDirectories: false,
    onlyFiles: true,
    case: false,
  })

  // the search order is such that we prefer files closer to the project root, then
  // we go by file size in ascending order, because people often have a main
  // file that just includes a bunch of other files; then we go by name, in
  // order to be deterministic

  const files = await _sortFileList(unsortedFiles, directoryPath)
  let firstFileInRootFolder
  let doc = null

  while (files.length > 0 && doc == null) {
    const file = files.shift()
    const content = await fs.promises.readFile(
      Path.join(directoryPath, file),
      'utf8'
    )
    const normalizedContent = (content || '').replace(/\r/g, '')
    if (DocumentHelper.contentHasDocumentclass(normalizedContent)) {
      doc = { path: file, content: normalizedContent }
    }

    if (!firstFileInRootFolder && !file.includes('/')) {
      firstFileInRootFolder = { path: file, content: normalizedContent }
    }
  }

  // if no doc was found, use the first file in the root folder as the main doc
  if (!doc && firstFileInRootFolder) {
    doc = firstFileInRootFolder
  }

  return { path: doc?.path, content: doc?.content }
}

async function setRootDocFromName(projectId, rootDocName) {
  const docPaths =
    await ProjectEntityHandler.promises.getAllDocPathsFromProjectById(projectId)

  let docId, path
  // strip off leading and trailing quotes from rootDocName
  rootDocName = rootDocName.replace(/^'|'$/g, '')
  // prepend a slash for the root folder if not present
  if (rootDocName[0] !== '/') {
    rootDocName = `/${rootDocName}`
  }
  // find the root doc from the filename
  let rootDocId = null
  for (docId in docPaths) {
    // docpaths have a leading / so allow matching "folder/filename" and "/folder/filename"
    path = docPaths[docId]
    if (path === rootDocName) {
      rootDocId = docId
    }
  }
  // try a basename match if there was no match
  if (!rootDocId) {
    for (docId in docPaths) {
      path = docPaths[docId]
      if (Path.basename(path) === Path.basename(rootDocName)) {
        rootDocId = docId
      }
    }
  }
  // set the root doc id if we found a match
  if (rootDocId != null) {
    return await ProjectEntityUpdateHandler.promises.setRootDoc(
      projectId,
      rootDocId
    )
  }
}

async function ensureRootDocumentIsSet(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    rootDoc_id: 1,
  })
  if (!project) {
    throw new Error('project not found')
  }
  if (project.rootDoc_id != null) {
    return
  }
  return await ProjectRootDocManager.promises.setRootDocAutomatically(projectId)
}

/**
 * @param {ObjectId | string} projectId
 */
async function ensureRootDocumentIsValid(projectId) {
  const project =
    await ProjectGetter.promises.getProjectWithoutDocLines(projectId)
  if (!project) {
    throw new Error('project not found')
  }
  if (project.rootDoc_id != null) {
    const docPath =
      await ProjectEntityHandler.promises.getDocPathFromProjectByDocId(
        project,
        project.rootDoc_id
      )
    if (docPath) {
      return
    }
    await ProjectEntityUpdateHandler.promises.unsetRootDoc(projectId)
  }
  return await ProjectRootDocManager.promises.setRootDocAutomatically(projectId)
}

async function _sortFileList(listToSort, rootDirectory) {
  const limit = pLimit(5)
  const files = await Promise.all(
    listToSort.map(filePath =>
      limit(async () => {
        const fullPath = Path.join(rootDirectory, filePath)
        const stat = await fs.promises.stat(fullPath)
        return {
          size: stat.size,
          path: filePath,
          elements: filePath.split(Path.sep).length,
          name: Path.basename(filePath),
        }
      })
    )
  )
  return files.sort(_rootDocSort).map(file => file.path)
}

function _rootDocSort(a, b) {
  // sort first by folder depth
  if (a.elements !== b.elements) {
    return a.elements - b.elements
  }
  // ensure main.tex is at the start of each folder
  if (a.name === 'main.tex' && b.name !== 'main.tex') {
    return -1
  }
  if (a.name !== 'main.tex' && b.name === 'main.tex') {
    return 1
  }
  // prefer smaller files
  if (a.size !== b.size) {
    return a.size - b.size
  }
  // otherwise, use the full path name
  return a.path.localeCompare(b.path)
}

const ProjectRootDocManager = {
  setRootDocAutomaticallyInBackground,
  setRootDocAutomatically: callbackify(setRootDocAutomatically),
  findRootDocFileFromDirectory: callbackifyMultiResult(
    findRootDocFileFromDirectory,
    ['path', 'content']
  ),
  setRootDocFromName: callbackify(setRootDocFromName),
  ensureRootDocumentIsSet: callbackify(ensureRootDocumentIsSet),
  ensureRootDocumentIsValid: callbackify(ensureRootDocumentIsValid),
  promises: {
    setRootDocAutomatically,
    findRootDocFileFromDirectory,
    setRootDocFromName,
    ensureRootDocumentIsSet,
    ensureRootDocumentIsValid,
  },
}

export default ProjectRootDocManager
