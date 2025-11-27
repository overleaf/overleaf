// @ts-check
import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { scriptRunner } from './lib/ScriptRunner.mjs'

/**
 * @typedef {Object} Doc
 * @property {ObjectId} _id
 * @property {string} name
 */

/**
 * @typedef {Object} FileRef
 * @property {ObjectId} _id
 * @property {string} name
 * @property {string} hash
 */

/**
 * @typedef {Object} Folder
 * @property {ObjectId} _id
 * @property {string} name
 * @property {Array<Doc>} docs
 * @property {Array<Folder>} folders
 * @property {Array<FileRef>} fileRefs
 */

/**
 * @typedef {Object} Project
 * @property {ObjectId} _id
 * @property {Array<Folder>} rootFolder
 */

/**
 * @param {(progress: string) => Promise<void>} trackProgress
 * @returns {Promise<void>}
 * @async
 */
async function main(trackProgress) {
  let projectsProcessed = 0
  await batchedUpdate(
    db.projects,
    {},
    /**
     * @param {Array<Project>} projects
     * @return {Promise<void>}
     */
    async function projects(projects) {
      for (const project of projects) {
        projectsProcessed += 1
        if (projectsProcessed % 100000 === 0) {
          console.warn(projectsProcessed, 'projects processed')
        }
        const projectId = project._id.toString()
        for (const { reason, path, _id } of processProject(project)) {
          console.log(
            JSON.stringify({
              msg: 'bad file-tree path',
              projectId,
              reason,
              path,
              _id,
            })
          )
        }
      }
    },
    { _id: 1, rootFolder: 1 },
    undefined,
    { trackProgress }
  )
}

/**
 * @param {Project} project
 * @return {Generator<{path: string, reason: string, _id: any}, void, *>}
 */
function* processProject(project) {
  if (!project.rootFolder || !Array.isArray(project.rootFolder)) {
    yield { reason: 'bad rootFolder', path: 'rootFolder', _id: null }
  } else if (!project.rootFolder[0]) {
    yield { reason: 'missing rootFolder', path: 'rootFolder.0', _id: null }
  } else {
    for (const { path, reason, _id } of findBadPaths(project.rootFolder[0])) {
      yield { reason, path: `rootFolder.0${path}`, _id }
    }
  }
}

/**
 * @param {Folder} folder
 * @return {Generator<{path: string, reason: string, _id: any}, void, *>}
 */
function* findBadPaths(folder) {
  const folderId = folder._id

  if (!(folderId instanceof ObjectId)) {
    yield { path: '._id', reason: 'bad folder id', _id: folderId }
  }

  if (typeof folder.name !== 'string' || !folder.name) {
    yield { path: '.name', reason: 'bad folder name', _id: folderId }
  }

  if (folder.folders && Array.isArray(folder.folders)) {
    for (const [i, subfolder] of folder.folders.entries()) {
      if (!subfolder || typeof subfolder !== 'object') {
        yield { path: `.folders.${i}`, reason: 'bad folder', _id: folderId }
        continue
      }
      for (const { path, reason, _id } of findBadPaths(subfolder)) {
        yield { path: `.folders.${i}${path}`, reason, _id }
      }
    }
  } else {
    yield { path: '.folders', reason: 'missing .folders', _id: folderId }
  }

  if (folder.docs && Array.isArray(folder.docs)) {
    for (const [i, doc] of folder.docs.entries()) {
      if (!doc || typeof doc !== 'object') {
        yield { path: `.docs.${i}`, reason: 'bad doc', _id: folderId }
        continue
      }
      const docId = doc._id
      if (!(docId instanceof ObjectId)) {
        yield { path: `.docs.${i}._id`, reason: 'bad doc id', _id: docId }
        // no need to check further: this doc can be deleted
        continue
      }
      if (typeof doc.name !== 'string' || !doc.name) {
        yield { path: `.docs.${i}.name`, reason: 'bad doc name', _id: docId }
      }
    }
  } else {
    yield { path: '.docs', reason: 'missing .docs', _id: folderId }
  }

  if (folder.fileRefs && Array.isArray(folder.fileRefs)) {
    for (const [i, file] of folder.fileRefs.entries()) {
      if (!file || typeof file !== 'object') {
        yield { path: `.fileRefs.${i}`, reason: 'bad file', _id: folderId }
        continue
      }
      const fileId = file._id
      if (!(fileId instanceof ObjectId)) {
        yield { path: `.fileRefs.${i}._id`, reason: 'bad file id', _id: fileId }
        // no need to check further: this file can be deleted
        continue
      }
      if (typeof file.name !== 'string' || !file.name) {
        yield {
          path: `.fileRefs.${i}.name`,
          reason: 'bad file name',
          _id: fileId,
        }
      }
      if (typeof file.hash !== 'string' || !file.hash) {
        yield {
          path: `.fileRefs.${i}.hash`,
          reason: 'bad file hash',
          _id: fileId,
        }
      }
    }
  } else {
    yield { path: '.fileRefs', reason: 'missing .fileRefs', _id: folderId }
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
