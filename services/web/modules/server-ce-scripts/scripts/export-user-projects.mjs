import minimist from 'minimist'
import {
  mkdirSync,
  createWriteStream,
  existsSync,
  unlinkSync,
  renameSync,
} from 'fs'
import { pipeline } from 'stream/promises'
import DocumentUpdaterHandler from '../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import ProjectZipStreamManager from '../../../app/src/Features/Downloads/ProjectZipStreamManager.mjs'
import logger from '@overleaf/logger'
import { promisify } from '@overleaf/promise-utils'
import { gracefulShutdown } from '../../../app/src/infrastructure/GracefulShutdown.mjs'
import { Project } from '../../../app/src/models/Project.mjs'
import { User } from '../../../app/src/models/User.mjs'
import readline from 'readline'

function parseArgs() {
  return minimist(process.argv.slice(2), {
    boolean: ['help', 'list', 'export-all'],
    string: ['user-id', 'output', 'project-id', 'output-dir', 'log-level'],
    alias: { help: 'h' },
    default: {
      'log-level': 'error',
    },
  })
}

function showUsage() {
  console.log(`
Usage: node scripts/export-user-projects.mjs [options]
  --help, -h          Show help
  --user-id           The user ID (required unless using --export-all or --project-id)
  --project-id        Export a single project (cannot be used with --user-id or --export-all)
  --list              List user's projects (cannot be used with --output)
  --output            Output zip file (for single export operations)
  --export-all        Export all users' projects (requires --output-dir)
  --output-dir        Directory for storing all users' export files
  --log-level         Log level (trace|debug|info|warn|error|fatal) [default: error]
`)
}

async function findAllUsers() {
  const users = await User.find({}, 'email').exec()
  return users
}

async function findUserProjects(userId) {
  const ownedProjects = await Project.find({ owner_ref: userId }, 'name').exec()
  return ownedProjects
}

async function listProjects(userId) {
  const projects = await findUserProjects(userId)
  for (const p of projects) {
    console.log(`${p._id} - ${p.name}`)
  }
}

const createZipStreamForMultipleProjectsAsync = promisify(
  ProjectZipStreamManager.createZipStreamForMultipleProjects
).bind(ProjectZipStreamManager)

function updateProgress(current, total) {
  if (!process.stdout.isTTY) return
  const width = 40
  const progress = Math.floor((current / total) * width)
  const SOLID_BLOCK = '\u2588' // Unicode "Full Block"
  const LIGHT_SHADE = '\u2591' // Unicode "Light Shade"
  const bar =
    SOLID_BLOCK.repeat(progress) + LIGHT_SHADE.repeat(width - progress)
  const percentage = Math.floor((current / total) * 100)
  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write(
    `Progress: [${bar}] ${percentage}% (${current}/${total} projects)`
  )
}

async function exportUserProjectsToZip(userId, output) {
  const projects = await findUserProjects(userId)
  const allIds = projects.map(p => p._id)
  if (allIds.length === 0) {
    console.log('No projects found for user')
    return
  }
  console.log('Flushing projects to MongoDB...')
  for (const [index, id] of allIds.entries()) {
    await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(id)
    updateProgress(index + 1, allIds.length)
  }
  console.log('\nAll projects flushed, creating zip...')

  console.log(
    `Exporting ${allIds.length} projects for user ${userId} to ${output}`
  )

  const zipStream = await createZipStreamForMultipleProjectsAsync(allIds)

  zipStream.on('progress', progress => {
    updateProgress(progress.entries.total, allIds.length)
  })

  await writeStreamToFileAtomically(zipStream, output)
  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  console.log(`Successfully exported ${allIds.length} projects to ${output}`)
}

async function writeStreamToFileAtomically(stream, finalPath) {
  const tmpPath = `${finalPath}-${Date.now()}.tmp`
  const outStream = createWriteStream(tmpPath, { flags: 'wx' })
  try {
    await pipeline(stream, outStream)
    renameSync(tmpPath, finalPath)
  } catch (err) {
    try {
      unlinkSync(tmpPath)
    } catch {
      console.log('Leaving behind tmp file, please cleanup manually:', tmpPath)
    }
    throw err
  }
}

const createZipStreamForProjectAsync = promisify(
  ProjectZipStreamManager.createZipStreamForProject
).bind(ProjectZipStreamManager)

async function exportSingleProject(projectId, output) {
  console.log('Flushing project to MongoDB...')
  await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(projectId)
  console.log(`Exporting project ${projectId} to ${output}`)
  const zipStream = await createZipStreamForProjectAsync(projectId)
  await writeStreamToFileAtomically(zipStream, output)
  console.log('Exported project to', output)
}

async function exportAllUsersProjects(outputDir) {
  const users = await findAllUsers()
  console.log(`Found ${users.length} users to process`)

  mkdirSync(outputDir, { recursive: true })

  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const safeEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const outputFile = `${outputDir}/${user._id}_${safeEmail}_projects.zip`

    if (existsSync(outputFile)) {
      console.log(`Skipping ${user._id} - file already exists`)
      continue
    }

    console.log(`Processing user ${i + 1}/${users.length} (${user._id})`)
    await exportUserProjectsToZip(user._id, outputFile)
  }
}

async function main() {
  const argv = parseArgs()

  if (argv.help) {
    showUsage()
    process.exit(0)
  }

  if (argv['log-level']) {
    logger.logger.level(argv['log-level'])
  }

  if (argv.list && argv.output) {
    console.error('Cannot use both --list and --output together')
    process.exit(1)
  }

  if (
    [argv['user-id'], argv['project-id'], argv['export-all']].filter(Boolean)
      .length > 1
  ) {
    console.error('Can only use one of: --user-id, --project-id, --export-all')
    process.exit(1)
  }

  try {
    if (argv.list) {
      if (!argv['user-id']) {
        console.error('--list requires --user-id')
        process.exit(1)
      }
      await listProjects(argv['user-id'])
      return
    }

    if (argv['export-all']) {
      if (!argv['output-dir']) {
        console.error('--export-all requires --output-dir')
        process.exit(1)
      }
      await exportAllUsersProjects(argv['output-dir'])
      return
    }

    if (!argv.output) {
      console.error('Please specify an --output zip file')
      process.exit(1)
    }

    if (argv['project-id']) {
      await exportSingleProject(argv['project-id'], argv.output)
    } else if (argv['user-id']) {
      await exportUserProjectsToZip(argv['user-id'], argv.output)
    } else {
      console.error(
        'Please specify either --user-id, --project-id, or --export-all'
      )
      process.exit(1)
    }
  } finally {
    await gracefulShutdown({ close: done => done() })
  }
}

main()
  .then(async () => {
    console.log('Done.')
  })
  .catch(async err => {
    logger.error({ err }, 'Error in export-user-projects script')
    process.exitCode = 1
  })
