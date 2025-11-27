/* eslint-disable @overleaf/require-script-runner */
import minimist from 'minimist'
import {
  mkdirSync,
  createWriteStream,
  existsSync,
  unlinkSync,
  renameSync,
} from 'node:fs'
import mongodb from '../../../app/src/infrastructure/mongodb.mjs'
import DocumentUpdaterHandler from '../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import ProjectZipStreamManager from '../../../app/src/Features/Downloads/ProjectZipStreamManager.mjs'
import logger from 'logger-sharelatex'
import { Project } from '../../../app/src/models/Project.mjs'
import { User } from '../../../app/src/models/User.mjs'
import readline from 'node:readline'

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

function findAllUsers(callback) {
  User.find({}, 'email', callback)
}

function findUserProjects(userId, callback) {
  Project.find({ owner_ref: userId }, 'name', callback)
}

function listProjects(userId, callback) {
  findUserProjects(userId, function (err, projects) {
    if (err) return callback(err)
    projects.forEach(function (p) {
      console.log(`${p._id} - ${p.name}`)
    })
    callback()
  })
}

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

function exportUserProjectsToZip(userId, output, callback) {
  findUserProjects(userId, function (err, projects) {
    if (err) return callback(err)
    const allIds = projects.map(p => p._id)
    if (allIds.length === 0) {
      console.log('No projects found for user')
      return callback()
    }

    console.log('Flushing projects to MongoDB...')
    let completed = 0

    function flushNext() {
      if (completed >= allIds.length) {
        createZip()
        return
      }

      DocumentUpdaterHandler.flushProjectToMongoAndDelete(
        allIds[completed],
        function (err) {
          if (err) return callback(err)
          updateProgress(completed + 1, allIds.length)
          completed++
          flushNext()
        }
      )
    }

    function createZip() {
      console.log('\nAll projects flushed, creating zip...')
      console.log(
        `Exporting ${allIds.length} projects for user ${userId} to ${output}`
      )

      ProjectZipStreamManager.createZipStreamForMultipleProjects(
        allIds,
        function (err, zipStream) {
          if (err) return callback(err)

          zipStream.on('progress', progress => {
            updateProgress(progress.entries.total, allIds.length)
          })

          writeStreamToFileAtomically(zipStream, output, function (err) {
            if (err) return callback(err)
            readline.clearLine(process.stdout, 0)
            readline.cursorTo(process.stdout, 0)
            console.log(
              `Successfully exported ${allIds.length} projects to ${output}`
            )
            callback()
          })
        }
      )
    }

    flushNext()
  })
}

function writeStreamToFileAtomically(stream, finalPath, callback) {
  const tmpPath = `${finalPath}-${Date.now()}.tmp`
  const outStream = createWriteStream(tmpPath, { flags: 'wx' })

  stream.pipe(outStream)

  outStream.on('error', function (err) {
    try {
      unlinkSync(tmpPath)
    } catch {
      console.log('Leaving behind tmp file, please cleanup manually:', tmpPath)
    }
    callback(err)
  })

  outStream.on('finish', function () {
    try {
      renameSync(tmpPath, finalPath)
      callback()
    } catch (err) {
      try {
        unlinkSync(tmpPath)
      } catch {
        console.log(
          'Leaving behind tmp file, please cleanup manually:',
          tmpPath
        )
      }
      callback(err)
    }
  })
}

function exportSingleProject(projectId, output, callback) {
  console.log('Flushing project to MongoDB...')
  DocumentUpdaterHandler.flushProjectToMongoAndDelete(
    projectId,
    function (err) {
      if (err) return callback(err)

      console.log(`Exporting project ${projectId} to ${output}`)
      ProjectZipStreamManager.createZipStreamForProject(
        projectId,
        function (err, zipStream) {
          if (err) return callback(err)
          writeStreamToFileAtomically(zipStream, output, function (err) {
            if (err) return callback(err)
            console.log('Exported project to', output)
            callback()
          })
        }
      )
    }
  )
}

function exportAllUsersProjects(outputDir, callback) {
  findAllUsers(function (err, users) {
    if (err) return callback(err)

    console.log(`Found ${users.length} users to process`)
    mkdirSync(outputDir, { recursive: true })

    let userIndex = 0
    function processNextUser() {
      if (userIndex >= users.length) {
        return callback()
      }

      const user = users[userIndex]
      const safeEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const outputFile = `${outputDir}/${user._id}_${safeEmail}_projects.zip`

      if (existsSync(outputFile)) {
        console.log(`Skipping ${user._id} - file already exists`)
        userIndex++
        return processNextUser()
      }

      console.log(
        `Processing user ${userIndex + 1}/${users.length} (${user._id})`
      )
      exportUserProjectsToZip(user._id, outputFile, function (err) {
        if (err) return callback(err)
        userIndex++
        processNextUser()
      })
    }

    processNextUser()
  })
}

function main() {
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

  function cleanup(err) {
    // Allow the script to finish gracefully then exit
    setTimeout(() => {
      if (err) {
        logger.error({ err }, 'Error in export-user-projects script')
        process.exit(1)
      } else {
        console.log('Done.')
        process.exit(0)
      }
    }, 1000)
  }

  if (argv.list) {
    if (!argv['user-id']) {
      console.error('--list requires --user-id')
      process.exit(1)
    }
    listProjects(argv['user-id'], cleanup)
    return
  }

  if (argv['export-all']) {
    if (!argv['output-dir']) {
      console.error('--export-all requires --output-dir')
      process.exit(1)
    }
    exportAllUsersProjects(argv['output-dir'], cleanup)
    return
  }

  if (!argv.output) {
    console.error('Please specify an --output zip file')
    process.exit(1)
  }

  if (argv['project-id']) {
    exportSingleProject(argv['project-id'], argv.output, cleanup)
  } else if (argv['user-id']) {
    exportUserProjectsToZip(argv['user-id'], argv.output, cleanup)
  } else {
    console.error(
      'Please specify either --user-id, --project-id, or --export-all'
    )
    process.exit(1)
  }
}

mongodb
  .waitForDb()
  .then(main)
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err)
    process.exit(1)
  })
