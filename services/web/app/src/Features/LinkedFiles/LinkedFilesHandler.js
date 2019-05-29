/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
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
  BadDataError
} = require('./LinkedFilesErrors')

module.exports = LinkedFilesHandler = {
  getFileById(project_id, file_id, callback) {
    if (callback == null) {
      callback = function(err, file) {}
    }
    return ProjectLocator.findElement(
      {
        project_id,
        element_id: file_id,
        type: 'file'
      },
      function(err, file, path, parentFolder) {
        if (err != null) {
          return callback(err)
        }
        return callback(null, file, path, parentFolder)
      }
    )
  },

  getSourceProject(data, callback) {
    if (callback == null) {
      callback = function(err, project) {}
    }
    const projection = { _id: 1, name: 1 }
    if (data.v1_source_doc_id != null) {
      return Project.findOne(
        { 'overleaf.id': data.v1_source_doc_id },
        projection,
        function(err, project) {
          if (err != null) {
            return callback(err)
          }
          if (project == null) {
            return callback(new V1ProjectNotFoundError())
          }
          return callback(null, project)
        }
      )
    } else if (data.source_project_id != null) {
      return ProjectGetter.getProject(
        data.source_project_id,
        projection,
        function(err, project) {
          if (err != null) {
            return callback(err)
          }
          if (project == null) {
            return callback(new ProjectNotFoundError())
          }
          return callback(null, project)
        }
      )
    } else {
      return callback(new BadDataError('neither v1 nor v2 id present'))
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
      callback = function(err, file) {}
    }
    callback = _.once(callback)
    return FileWriter.writeStreamToDisk(project_id, readStream, function(
      err,
      fsPath
    ) {
      if (err != null) {
        return callback(err)
      }
      return EditorController.upsertFile(
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
          return callback(null, file)
        }
      )
    })
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
      callback = function(err, file) {}
    }
    callback = _.once(callback)
    return FileWriter.writeContentToDisk(project_id, content, function(
      err,
      fsPath
    ) {
      if (err != null) {
        return callback(err)
      }
      return EditorController.upsertFile(
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
          return callback(null, file)
        }
      )
    })
  }
}
