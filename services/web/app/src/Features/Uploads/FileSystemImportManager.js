/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FileSystemImportManager
const async = require('async')
const fs = require('fs')
const _ = require('underscore')
const FileTypeManager = require('./FileTypeManager')
const EditorController = require('../Editor/EditorController')
const logger = require('logger-sharelatex')

module.exports = FileSystemImportManager = {
  addDoc(
    user_id,
    project_id,
    folder_id,
    name,
    path,
    charset,
    replace,
    callback
  ) {
    if (callback == null) {
      callback = function(error, doc) {}
    }
    return FileSystemImportManager._isSafeOnFileSystem(path, function(
      err,
      isSafe
    ) {
      if (!isSafe) {
        logger.log(
          { user_id, project_id, folder_id, name, path },
          'add doc is from symlink, stopping process'
        )
        return callback(new Error('path is symlink'))
      }
      return fs.readFile(path, charset, function(error, content) {
        if (error != null) {
          return callback(error)
        }
        content = content.replace(/\r\n?/g, '\n') // convert Windows line endings to unix. very old macs also created \r-separated lines
        const lines = content.split('\n')
        if (replace) {
          return EditorController.upsertDoc(
            project_id,
            folder_id,
            name,
            lines,
            'upload',
            user_id,
            callback
          )
        } else {
          return EditorController.addDoc(
            project_id,
            folder_id,
            name,
            lines,
            'upload',
            user_id,
            callback
          )
        }
      })
    })
  },

  addFile(user_id, project_id, folder_id, name, path, replace, callback) {
    if (callback == null) {
      callback = function(error, file) {}
    }
    return FileSystemImportManager._isSafeOnFileSystem(path, function(
      err,
      isSafe
    ) {
      if (!isSafe) {
        logger.log(
          { user_id, project_id, folder_id, name, path },
          'add file is from symlink, stopping insert'
        )
        return callback(new Error('path is symlink'))
      }

      if (replace) {
        return EditorController.upsertFile(
          project_id,
          folder_id,
          name,
          path,
          null,
          'upload',
          user_id,
          callback
        )
      } else {
        return EditorController.addFile(
          project_id,
          folder_id,
          name,
          path,
          null,
          'upload',
          user_id,
          callback
        )
      }
    })
  },

  addFolder(user_id, project_id, folder_id, name, path, replace, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return FileSystemImportManager._isSafeOnFileSystem(path, function(
      err,
      isSafe
    ) {
      if (!isSafe) {
        logger.log(
          { user_id, project_id, folder_id, path },
          'add folder is from symlink, stopping insert'
        )
        return callback(new Error('path is symlink'))
      }
      return EditorController.addFolder(
        project_id,
        folder_id,
        name,
        'upload',
        (error, new_folder) => {
          if (error != null) {
            return callback(error)
          }
          return FileSystemImportManager.addFolderContents(
            user_id,
            project_id,
            new_folder._id,
            path,
            replace,
            function(error) {
              if (error != null) {
                return callback(error)
              }
              return callback(null, new_folder)
            }
          )
        }
      )
    })
  },

  addFolderContents(
    user_id,
    project_id,
    parent_folder_id,
    folderPath,
    replace,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    return FileSystemImportManager._isSafeOnFileSystem(folderPath, function(
      err,
      isSafe
    ) {
      if (!isSafe) {
        logger.log(
          { user_id, project_id, parent_folder_id, folderPath },
          'add folder contents is from symlink, stopping insert'
        )
        return callback(new Error('path is symlink'))
      }
      return fs.readdir(folderPath, (error, entries) => {
        if (entries == null) {
          entries = []
        }
        if (error != null) {
          return callback(error)
        }
        return async.eachSeries(
          entries,
          (entry, callback) => {
            return FileTypeManager.shouldIgnore(entry, (error, ignore) => {
              if (error != null) {
                return callback(error)
              }
              if (!ignore) {
                return FileSystemImportManager.addEntity(
                  user_id,
                  project_id,
                  parent_folder_id,
                  entry,
                  `${folderPath}/${entry}`,
                  replace,
                  callback
                )
              } else {
                return callback()
              }
            })
          },
          callback
        )
      })
    })
  },

  addEntity(user_id, project_id, folder_id, name, path, replace, callback) {
    if (callback == null) {
      callback = function(error, entity) {}
    }
    return FileSystemImportManager._isSafeOnFileSystem(path, function(
      err,
      isSafe
    ) {
      if (!isSafe) {
        logger.log(
          { user_id, project_id, folder_id, path },
          'add entry is from symlink, stopping insert'
        )
        return callback(new Error('path is symlink'))
      }

      return FileTypeManager.isDirectory(path, (error, isDirectory) => {
        if (error != null) {
          return callback(error)
        }
        if (isDirectory) {
          return FileSystemImportManager.addFolder(
            user_id,
            project_id,
            folder_id,
            name,
            path,
            replace,
            callback
          )
        } else {
          return FileTypeManager.getType(
            name,
            path,
            (error, isBinary, charset) => {
              if (error != null) {
                return callback(error)
              }
              if (isBinary) {
                return FileSystemImportManager.addFile(
                  user_id,
                  project_id,
                  folder_id,
                  name,
                  path,
                  replace,
                  function(err, entity) {
                    if (entity != null) {
                      entity.type = 'file'
                    }
                    return callback(err, entity)
                  }
                )
              } else {
                return FileSystemImportManager.addDoc(
                  user_id,
                  project_id,
                  folder_id,
                  name,
                  path,
                  charset,
                  replace,
                  function(err, entity) {
                    if (entity != null) {
                      entity.type = 'doc'
                    }
                    return callback(err, entity)
                  }
                )
              }
            }
          )
        }
      })
    })
  },

  _isSafeOnFileSystem(path, callback) {
    if (callback == null) {
      callback = function(err, isSafe) {}
    }
    return fs.lstat(path, function(err, stat) {
      if (err != null) {
        logger.warn({ err }, 'error with path symlink check')
        return callback(err)
      }
      const isSafe = stat.isFile() || stat.isDirectory()
      return callback(err, isSafe)
    })
  }
}
