const archiver = require('archiver')
const OutputCacheManager = require('./OutputCacheManager')
const OutputFileFinder = require('./OutputFileFinder')
const Settings = require('@overleaf/settings')
const { open } = require('node:fs/promises')
const { NotFoundError } = require('./Errors')
const logger = require('@overleaf/logger')

// NOTE: Updating this list requires a corresponding change in
// * services/web/frontend/js/features/pdf-preview/util/file-list.ts
const ignoreFiles = ['output.fls', 'output.fdb_latexmk']

function getContentDir(projectId, userId) {
  let subDir
  if (userId != null) {
    subDir = `${projectId}-${userId}`
  } else {
    subDir = projectId
  }
  return `${Settings.path.outputDir}/${subDir}/`
}

module.exports = {
  async archiveFilesForBuild(projectId, userId, build) {
    logger.debug({ projectId, userId, build }, 'Will create zip file')

    const contentDir = getContentDir(projectId, userId)

    const outputFiles = await this._getAllOutputFiles(
      contentDir,
      projectId,
      userId,
      build
    )

    const archive = archiver('zip')

    archive.on('error', err => {
      logger.warn(
        { err, projectId, userId, build },
        'error emitted when creating output files archive'
      )
    })

    archive.on('warning', err => {
      logger.warn(
        { err, projectId, userId, build },
        'warning emitted when creating output files archive'
      )
    })

    const missingFiles = []

    for (const { path } of outputFiles) {
      let fileHandle
      try {
        fileHandle = await open(
          `${contentDir}${OutputCacheManager.path(build, path)}`
        )
      } catch (error) {
        logger.warn(
          { path, error, projectId, userId, build },
          'error opening file to add to output files archive'
        )
        missingFiles.push(path)
        continue
      }
      const fileStream = fileHandle.createReadStream()
      archive.append(fileStream, { name: path })
    }

    if (missingFiles.length > 0) {
      archive.append(missingFiles.join('\n'), {
        name: 'missing_files.txt',
      })
    }

    archive.finalize().catch(error => {
      logger.error(
        { error, projectId, userId, build },
        'error finalizing output files archive'
      )
    })

    return archive
  },

  async _getAllOutputFiles(contentDir, projectId, userId, build) {
    try {
      const { outputFiles } = await OutputFileFinder.promises.findOutputFiles(
        [],
        `${contentDir}${OutputCacheManager.path(build, '.')}`
      )

      return outputFiles.filter(
        // Ignore the pdf, clsi-cache tar-ball and also ignore the files ignored by the frontend.
        ({ path }) =>
          path !== 'output.pdf' &&
          path !== 'output.tar.gz' &&
          !ignoreFiles.includes(path)
      )
    } catch (error) {
      if (
        error.code === 'ENOENT' ||
        error.code === 'ENOTDIR' ||
        error.code === 'EACCES'
      ) {
        throw new NotFoundError('Output files not found')
      }
      throw error
    }
  },
}
