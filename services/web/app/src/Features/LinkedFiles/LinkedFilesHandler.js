/* eslint-disable
    camelcase,
    n/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LinkedFilesHandler
const FileWriter = require('../../infrastructure/FileWriter')
const EditorController = require('../Editor/EditorController')
const ProjectLocator = require('../Project/ProjectLocator')
const { Project } = require('../../models/Project')
const ProjectGetter = require('../Project/ProjectGetter')
const _ = require('underscore')
const {
  ProjectNotFoundError,
  V1ProjectNotFoundError,
  BadDataError,
} = require('./LinkedFilesErrors')

module.exports = LinkedFilesHandler = {
  getFileById(project_id, file_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    ProjectLocator.findElement(
      {
        project_id,
        element_id: file_id,
        type: 'file',
      },
      function (err, file, path, parentFolder) {
        if (err != null) {
          return callback(err)
        }
        callback(null, file, path, parentFolder)
      }
    )
  },

  getSourceProject(data, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const projection = { _id: 1, name: 1 }
    if (data.v1_source_doc_id != null) {
      Project.findOne(
        { 'overleaf.id': data.v1_source_doc_id },
        projection,
        function (err, project) {
          if (err != null) {
            return callback(err)
          }
          if (project == null) {
            return callback(new V1ProjectNotFoundError())
          }
          callback(null, project)
        }
      )
    } else if (data.source_project_id != null) {
      ProjectGetter.getProject(
        data.source_project_id,
        projection,
        function (err, project) {
          if (err != null) {
            return callback(err)
          }
          if (project == null) {
            return callback(new ProjectNotFoundError())
          }
          callback(null, project)
        }
      )
    } else {
      callback(new BadDataError('neither v1 nor v2 id present'))
    }
  },

  importFromStream(
    project_id,
    readStream,
    linkedFileData,
    name,
    parent_folder_id,
    user_id,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    callback = _.once(callback)
    FileWriter.writeStreamToDisk(
      project_id,
      readStream,
      function (err, fsPath) {
        if (err != null) {
          return callback(err)
        }
        EditorController.upsertFile(
          project_id,
          parent_folder_id,
          name,
          fsPath,
          linkedFileData,
          'upload',
          user_id,
          (err, file) => {
            if (err != null) {
              return callback(err)
            }
            callback(null, file)
          }
        )
      }
    )
  },

  importContent(
    project_id,
    content,
    linkedFileData,
    name,
    parent_folder_id,
    user_id,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    callback = _.once(callback)
    FileWriter.writeContentToDisk(project_id, content, function (err, fsPath) {
      if (err != null) {
        return callback(err)
      }
      EditorController.upsertFile(
        project_id,
        parent_folder_id,
        name,
        fsPath,
        linkedFileData,
        'upload',
        user_id,
        (err, file) => {
          if (err != null) {
            return callback(err)
          }
          callback(null, file)
        }
      )
    })
  },
}
