const archiver = require('archiver')
const OutputCacheManager = require('./OutputCacheManager')
const OutputFileFinder = require('./OutputFileFinder')
const Settings = require('@overleaf/settings')
const { open, realpath } = require('node:fs/promises')
const path = require('path')
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

/**
 * Is the provided path a symlink?
 * @param {string} path
 * @return {Promise<boolean>}
 */
async function isSymlink(path) {
  try {
    const realPath = await realpath(path)
    return realPath !== path
  } catch (error) {
    if (error.code === 'ELOOP') {
      return true
    }
    throw error
  }
}

module.exports = {
  async archiveFilesForBuild(projectId, userId, build) {
    const validFiles = await this._getAllOutputFiles(projectId, userId, build)

    const archive = archiver('zip')

    const missingFiles = []

    for (const file of validFiles) {
      try {
        if (!(await isSymlink(file))) {
          const fileHandle = await open(file, 'r')
          const fileStream = fileHandle.createReadStream()
          archive.append(fileStream, { name: path.basename(file) })
        }
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

      return outputFiles
        .filter(({ path }) => path !== 'output.pdf')
        .map(
          ({ path }) => `${contentDir}${OutputCacheManager.path(build, path)}`
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
