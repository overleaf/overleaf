let OutputFileArchiveManager
const archiver = require('archiver')
const OutputCacheManager = require('./OutputCacheManager')
const OutputFileFinder = require('./OutputFileFinder')
const Settings = require('@overleaf/settings')
const { open } = require('node:fs/promises')
const path = require('node:path')
const { NotFoundError } = require('./Errors')

function getContentDir(projectId, userId) {
  let subDir
  if (userId != null) {
    subDir = `${projectId}-${userId}`
  } else {
    subDir = projectId
  }
  return `${Settings.path.outputDir}/${subDir}/`
}

module.exports = OutputFileArchiveManager = {
  async archiveFilesForBuild(projectId, userId, build, files = []) {
    const contentDir = getContentDir(projectId, userId)

    const validFiles = await (files.length > 0
      ? this._getRequestedOutputFiles(projectId, userId, build, files)
      : this._getAllOutputFiles(projectId, userId, build))

    const archive = archiver('zip')

    const missingFiles = files.filter(
      file => !validFiles.includes(path.basename(file))
    )

    for (const file of validFiles) {
      try {
        const fileHandle = await open(
          `${contentDir}${OutputCacheManager.path(build, file)}`
        )
        const fileStream = fileHandle.createReadStream()
        archive.append(fileStream, { name: file })
      } catch (error) {
        missingFiles.push(file)
      }
    }

    if (missingFiles.length > 0) {
      archive.append(missingFiles.join('\n'), {
        name: 'missing_files.txt',
      })
    }

    await archive.finalize()

    return archive
  },

  async _getAllOutputFiles(projectId, userId, build) {
    const contentDir = getContentDir(projectId, userId)

    try {
      const { outputFiles } = await OutputFileFinder.promises.findOutputFiles(
        [],
        `${contentDir}${OutputCacheManager.path(build, '.')}`
      )

      return outputFiles.map(({ path }) => path)
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

  async _getRequestedOutputFiles(projectId, userId, build, files) {
    const outputFiles = new Set(
      await OutputFileArchiveManager._getAllOutputFiles(
        projectId,
        userId,
        build
      )
    )

    return files.filter(file => outputFiles.has(file))
  },
}
