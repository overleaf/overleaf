const Settings = require('@overleaf/settings')
const Path = require('path')
const FileWriter = require('../../infrastructure/FileWriter')
const FileSystemImportManager = require('../Uploads/FileSystemImportManager')
const EditorController = require('../Editor/EditorController')
const Errors = require('../Errors/Errors')
const moment = require('moment')
const { callbackifyAll } = require('@overleaf/promise-utils')

const RestoreManager = {
  async restoreFileFromV2(userId, projectId, version, pathname) {
    const fsPath = await RestoreManager._writeFileVersionToDisk(
      projectId,
      version,
      pathname
    )
    const basename = Path.basename(pathname)
    let dirname = Path.dirname(pathname)
    if (dirname === '.') {
      // no directory
      dirname = ''
    }
    const parentFolderId = await RestoreManager._findOrCreateFolder(
      projectId,
      dirname
    )
    const addEntityWithName = async name =>
      await FileSystemImportManager.promises.addEntity(
        userId,
        projectId,
        parentFolderId,
        name,
        fsPath,
        false
      )
    return await RestoreManager._addEntityWithUniqueName(
      addEntityWithName,
      basename
    )
  },

  async _findOrCreateFolder(projectId, dirname) {
    const { lastFolder } = await EditorController.promises.mkdirp(
      projectId,
      dirname
    )
    return lastFolder?._id
  },

  async _addEntityWithUniqueName(addEntityWithName, basename) {
    try {
      return await addEntityWithName(basename)
    } catch (error) {
      if (error instanceof Errors.InvalidNameError) {
        // likely a duplicate name, so try with a prefix
        const date = moment(new Date()).format('Do MMM YY H:mm:ss')
        // Move extension to the end so the file type is preserved
        const extension = Path.extname(basename)
        basename = Path.basename(basename, extension)
        basename = `${basename} (Restored on ${date})`
        if (extension !== '') {
          basename = `${basename}${extension}`
        }
        return await addEntityWithName(basename)
      } else {
        throw error
      }
    }
  },

  async _writeFileVersionToDisk(projectId, version, pathname) {
    const url = `${
      Settings.apis.project_history.url
    }/project/${projectId}/version/${version}/${encodeURIComponent(pathname)}`
    return await FileWriter.promises.writeUrlToDisk(projectId, url)
  },
}

module.exports = { ...callbackifyAll(RestoreManager), promises: RestoreManager }
