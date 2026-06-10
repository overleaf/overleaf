import minimist from 'minimist'
import fs from 'node:fs/promises'
import Path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import Errors from '../app/src/Features/Errors/Errors.js'
import ProjectLocator from '../app/src/Features/Project/ProjectLocator.mjs'
import ProjectEntityUpdateHandler from '../app/src/Features/Project/ProjectEntityUpdateHandler.mjs'
import SafePath from '../app/src/Features/Project/SafePath.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

function usage() {
  console.error(`Upload a local file into a project path

Usage: node scripts/upload_file.mjs [options] FILE

Required:
  FILE                 Local filesystem path to file to upload
  --project-id ID      Project id
  --user-id ID         User id performing the action

Optional:
  --dest PATH          Destination project path (default: basename of FILE)
  --source VALUE       Source label for history
                       (default: script-upload-file)
  --force              Allow overwrite when destination already exists
  -y                   Skip interactive confirmation prompt
  --dry-run            Show what would happen without mutating the project
  --help               Show this help

Example:
  node scripts/upload_file.mjs /tmp/plot.png --project-id=... --user-id=... \
    --dest=/figures/plot.png --dry-run`)
}

function parseArgs() {
  let unknownArg
  const argv = minimist(process.argv.slice(2), {
    boolean: ['dry-run', 'force', 'help', 'y'],
    string: ['project-id', 'user-id', 'dest', 'source'],
    alias: { y: 'yes' },
    unknown: arg => {
      if (arg.startsWith('-')) {
        unknownArg = arg
        return false
      }
      return true
    },
  })

  if (unknownArg) {
    throw new Error(`unknown argument: ${unknownArg}`)
  }

  if (argv._.length === 0) {
    throw new Error('provide a local file path as FILE argument')
  }

  if (argv._.length > 1) {
    throw new Error('only one FILE argument is supported')
  }

  return {
    localPath: argv._[0],
    projectId: argv['project-id'],
    userId: argv['user-id'],
    destPath: argv.dest,
    source: argv.source || 'script-upload-file',
    force: argv.force === true,
    dryRun: argv['dry-run'] === true,
    assumeYes: argv.y === true || argv.yes === true,
    help: argv.help === true,
  }
}

function normalizeTargetPath(targetPath) {
  if (typeof targetPath !== 'string') {
    throw new TypeError('destination path must be a string')
  }

  if (targetPath.trim().length === 0) {
    throw new Error('destination path must not be empty')
  }

  return targetPath.startsWith('/') ? targetPath : `/${targetPath}`
}

async function validateInputs(opts) {
  const { projectId, userId, localPath } = opts

  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('provide a valid object id as --project-id')
  }
  if (!userId || !ObjectId.isValid(userId)) {
    throw new Error('provide a valid object id as --user-id')
  }
  if (!localPath || typeof localPath !== 'string') {
    throw new Error('provide a local file path as FILE argument')
  }

  let fileStat
  try {
    fileStat = await fs.stat(localPath)
  } catch (error) {
    throw new Error(`local file not found: ${localPath}`)
  }

  if (!fileStat.isFile()) {
    throw new Error(`local path is not a file: ${localPath}`)
  }

  const rawDestPath = opts.destPath ?? Path.basename(localPath)
  let targetPath
  try {
    targetPath = normalizeTargetPath(rawDestPath)
  } catch (error) {
    const invalidValue =
      opts.destPath !== undefined
        ? `--dest=${JSON.stringify(opts.destPath)}`
        : `derived basename ${rawDestPath} from FILE ${localPath}`
    throw new Error(
      `provide a non-empty destination project path; invalid value ${invalidValue}`
    )
  }

  if (!SafePath.isCleanPath(targetPath)) {
    throw new Errors.InvalidNameError('invalid --dest value')
  }

  const fileName = Path.posix.basename(targetPath)
  if (!fileName || fileName === '.' || fileName === '..') {
    throw new Error('destination path must include a file name')
  }

  return { ...opts, targetPath }
}

async function confirmUpload(projectId, localPath, targetPath, assumeYes) {
  if (assumeYes) {
    return true
  }

  const rl = readline.createInterface({ input, output })
  try {
    const answer = await rl.question(
      `Upload ${localPath} to ${targetPath} in project ${projectId}? [y/N] `
    )
    return /^y(es)?$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}

async function getExistingEntity(projectId, targetPath) {
  try {
    return await ProjectLocator.promises.findElementByPath({
      project_id: projectId,
      path: targetPath,
      exactCaseMatch: true,
    })
  } catch (error) {
    if (error instanceof Errors.NotFoundError) {
      return null
    }
    throw error
  }
}

async function main(trackProgress) {
  let opts = parseArgs()

  if (opts.help) {
    usage()
    return
  }

  opts = await validateInputs(opts)

  const {
    projectId,
    userId,
    targetPath,
    localPath,
    source,
    force,
    dryRun,
    assumeYes,
  } = opts

  await trackProgress(
    `Starting upload for project=${projectId} path=${targetPath} dryRun=${dryRun} force=${force}`
  )

  const existing = await getExistingEntity(projectId, targetPath)
  if (existing?.type === 'folder') {
    throw new Error(
      `destination is a folder at ${targetPath}. Choose a file path within that folder.`
    )
  }
  if (existing && !force) {
    throw new Error(
      `destination already exists at ${targetPath} (type=${existing.type}). Re-run with --force to overwrite.`
    )
  }

  const intendedAction = existing ? 'overwrite' : 'create'
  console.log(
    `${dryRun ? 'DRY RUN: would' : 'Applying: will'} ${intendedAction} file at ${targetPath}`
  )

  if (dryRun) {
    return
  }

  const confirmed = await confirmUpload(
    projectId,
    localPath,
    targetPath,
    assumeYes
  )
  if (!confirmed) {
    console.log('Upload cancelled.')
    return
  }

  const { fileRef, isNew } =
    await ProjectEntityUpdateHandler.promises.upsertFileWithPath(
      projectId,
      targetPath,
      localPath,
      null,
      userId,
      source
    )

  const outcome = existing
    ? `overwrote existing ${existing.type}`
    : isNew
      ? 'created file'
      : 'updated existing file'

  console.log(
    `Success: ${outcome}. fileId=${fileRef?._id} fileName=${fileRef?.name} projectId=${projectId} path=${targetPath}`
  )
}

try {
  await scriptRunner(main)
  console.log('Done.')
  process.exit(0)
} catch (error) {
  if (error instanceof Errors.InvalidNameError) {
    console.error(`Invalid name/path: ${error.message}`)
  } else {
    console.error(error)
  }
  usage()
  process.exit(1)
}
