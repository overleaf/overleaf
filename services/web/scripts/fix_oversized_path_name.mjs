// @ts-check
import path from 'node:path'
import minimist from 'minimist'
import DocumentUpdaterHandler from '../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import EditorController from '../app/src/Features/Editor/EditorController.mjs'
import ProjectEntityHandler from '../app/src/Features/Project/ProjectEntityHandler.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const MAX_PATH = 1024

const OPTS = parseArgs()

// EditorController.promises is attached by mutation, so it isn't visible on the
// imported type. Cast once here rather than at every call site.
const EditorControllerPromises = /** @type {any} */ (EditorController).promises

function usage() {
  console.error(
    'Usage: node fix_oversized_path_name.mjs [--commit] PROJECT_ID...'
  )
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit'],
  })
  if (args._.length === 0) {
    usage()
    process.exit(0)
  }
  return {
    projectIds: args._,
    commit: args.commit,
  }
}

/**
 * Shorten a path for log output — a full pathname can be enormous.
 * @param {string} fullPath
 */
function trimPath(fullPath) {
  return fullPath.length > 20
    ? `${fullPath.slice(0, 10)} ... ${fullPath.slice(-10)}`
    : fullPath
}

/**
 * Pass in a projectId and iterate the file tree to find oversized pathnames (over 1024 characters)
 * Create a new file with original pathname as the contents "Overleaf conflicted copy (<timestamp>) - path.txt
 * Rename existing file "Overleaf conflicted copy (<timestamp>) - content.txt"
 * Check if file already exists, bail out, in case there happens to already be a file or we run it twice, or script fails
 * @param {string} projectId
 * @param {(message: string) => Promise<void>} trackProgress
 * @returns {Promise<boolean>}
 */
async function fixOversizePathnames(projectId, trackProgress) {
  const project = await db.projects.findOne(
    { _id: new ObjectId(projectId) },
    {
      projection: { rootFolder: 1, owner_ref: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )

  if (!project) {
    logger.warn({ projectId }, 'Project not found')
    return false
  }

  const entities = findOversizedEntities(project)
  if (entities.length === 0) {
    console.log(`[${projectId}] No oversized pathnames found`)
    return true
  }

  const userId = project.owner_ref?.toString()

  if (!userId) {
    logger.warn({ projectId }, 'Project owner not found')
    return false
  }

  if (!OPTS.commit) {
    for (const entity of entities) {
      console.log(
        `[${projectId}] Would fix ${entity.type} "${trimPath(entity.fullPath)}" (${entity.fullPath.length} chars)`
      )
    }
    return true
  }

  // We are about to mutate the project, so block it from being loaded in
  // docupdater. If we can't get the lock (project is active) we do nothing.
  let blockSuccess

  try {
    blockSuccess = await DocumentUpdaterHandler.promises.blockProject(projectId)
  } catch (err) {
    logger.warn(
      { projectId, err },
      'Error thrown while acquiring block for project'
    )
    return false
  }
  if (!blockSuccess) {
    logger.warn({ projectId }, 'Project is currently active, skipping')
    return false
  }

  let success = true
  try {
    // One timestamp for the whole run, plus a per-entity counter, so the names
    // we create are unique across the project and can't collide with each other.
    const now = new Date().toISOString().replace(/[:.]/g, '-')
    for (let i = 0; i < entities.length; i++) {
      // Bail on the whole project if any entity fails: we hold the lock, so we
      // don't want to leave it half-fixed and keep mutating.
      await fixEntity(projectId, entities[i], userId, i, now, trackProgress)
    }
  } catch (err) {
    success = false
    logger.warn(
      { projectId, err },
      'Error fixing oversized pathname, bailing out of project'
    )
  } finally {
    try {
      await DocumentUpdaterHandler.promises.unblockProject(projectId)
    } catch (err) {
      logger.warn({ projectId, err }, 'Error unblocking project')
    }
  }
  return success
}

/**
 * @typedef {object} OversizedEntity
 * @property {string} name - the entity's own name (leaf of the path)
 * @property {ObjectId} id - the entity's _id
 * @property {'doc' | 'file'} type - entityType understood by EditorController
 * @property {ObjectId} parent - _id of the containing folder
 * @property {string} fullPath - full path from the project root
 * @property {Set<string>} siblingNames - names already used in the parent folder
 */

/**
 * Collect docs and files whose full pathname exceeds MAX_PATH. Uses
 * ProjectEntityHandler to walk the tree so malformed folders are handled the
 * same way as the rest of the app.
 *
 * @param {any} project
 * @returns {OversizedEntity[]}
 */
function findOversizedEntities(project) {
  const { folders } = ProjectEntityHandler.getAllEntitiesFromProject(project)
  /** @type {OversizedEntity[]} */
  const oversizedEntities = []
  for (const { path: folderPath, folder } of folders) {
    // folderPath is "/"-rooted (e.g. "/", "/sub"); strip it so fullPath is
    // relative to the project root.
    const prefix = folderPath === '/' ? '' : `${folderPath.slice(1)}/`
    // Names already used in this folder, so the fix can skip a name that is taken.
    /** @type {Set<string>} */
    const siblingNames = new Set()
    for (const entity of [...(folder.docs ?? []), ...(folder.fileRefs ?? [])]) {
      siblingNames.add(entity.name)
    }
    /** @type {Array<['docs' | 'fileRefs', 'doc' | 'file']>} */
    const groups = [
      ['docs', 'doc'],
      ['fileRefs', 'file'],
    ]
    for (const [key, type] of groups) {
      if (!Array.isArray(folder[key])) {
        continue
      }
      for (const entity of folder[key]) {
        const fullPath = `${prefix}${entity.name}`
        if (fullPath.length > MAX_PATH) {
          oversizedEntities.push({
            name: entity.name,
            id: entity._id,
            type,
            parent: folder._id,
            fullPath,
            siblingNames,
          })
        }
      }
    }
  }
  return oversizedEntities
}

/**
 * Extension (including the dot) of the original name, kept only when it is an
 * editable text extension so the renamed file stays usable (e.g. a .tex still
 * compiles). Falls back to .txt otherwise - binary files and junk leaf names
 * (the oversized part is usually folder nesting) become plain text.
 *
 * @param {string} name
 * @returns {string}
 */
function originalExtension(name) {
  const ext = path.extname(name).toLowerCase()
  return ext && Settings.textExtensions.includes(ext.slice(1)) ? ext : '.txt'
}

/**
 * @param {string} projectId
 * @param {OversizedEntity} entity
 * @param {string} userId
 * @param {number} index - position in this run, for a unique name
 * @param {string} now - shared timestamp for this run
 * @param {(message: string) => Promise<void>} trackProgress
 */
async function fixEntity(projectId, entity, userId, index, now, trackProgress) {
  const label = `(file ${index} on ${now})`
  const pathName = `Overleaf conflicted copy ${label} - path.txt`
  const contentName = `Overleaf conflicted copy ${label} - content${originalExtension(entity.name)}`

  // Skip if a file with either target name already exists (e.g. from an earlier
  // run) so we don't overwrite it or create a duplicate.
  if (
    entity.siblingNames.has(pathName) ||
    entity.siblingNames.has(contentName)
  ) {
    logger.warn(
      { projectId, entityId: entity.id },
      'Conflicted-copy file already exists, skipping'
    )
    return
  }

  // Create the record of the original pathname first: if the rename later
  // fails, this doc is the only thing holding the original name, so we can
  // safely delete it to revert. Renaming first would lose that name on failure.
  const newDoc = await EditorControllerPromises.addDoc(
    projectId,
    entity.parent,
    pathName,
    entity.fullPath.split('\n'),
    'Overleaf',
    userId
  )

  try {
    await EditorControllerPromises.renameEntity(
      projectId,
      entity.id,
      entity.type,
      contentName,
      userId,
      'Overleaf'
    )
  } catch (err) {
    // Roll back the doc we just created so this entity is left unchanged.
    await EditorControllerPromises.deleteEntity(
      projectId,
      newDoc._id,
      'doc',
      'Overleaf',
      userId
    )
    throw err
  }

  await trackProgress(
    `[${projectId}] Fixed ${entity.type} "${trimPath(entity.fullPath)}" (${entity.fullPath.length} chars) -> "${contentName}"; original path saved to "${pathName}"`
  )
}

/** @param {(message: string) => Promise<void>} trackProgress */
async function main(trackProgress) {
  for (const projectId of OPTS.projectIds) {
    await trackProgress(`Processing project ${projectId}`)
    await fixOversizePathnames(projectId, trackProgress)
  }

  if (!OPTS.commit) {
    await trackProgress(
      'This was a dry run. Rerun with --commit to apply changes'
    )
  }
}

try {
  await scriptRunner(main, OPTS)
  process.exit(0)
} catch (err) {
  console.error(err)
  process.exit(1)
}
