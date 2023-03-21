/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LinkedFilesController
const SessionManager = require('../Authentication/SessionManager')
const EditorController = require('../Editor/EditorController')
const ProjectLocator = require('../Project/ProjectLocator')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const _ = require('underscore')
const LinkedFilesHandler = require('./LinkedFilesHandler')
const {
  CompileFailedError,
  UrlFetchFailedError,
  InvalidUrlError,
  OutputFileFetchFailedError,
  AccessDeniedError,
  BadEntityTypeError,
  BadDataError,
  ProjectNotFoundError,
  V1ProjectNotFoundError,
  SourceFileNotFoundError,
  NotOriginalImporterError,
  FeatureNotAvailableError,
  RemoteServiceError,
  FileCannotRefreshError,
} = require('./LinkedFilesErrors')
const Modules = require('../../infrastructure/Modules')
const { plainTextResponse } = require('../../infrastructure/Response')

module.exports = LinkedFilesController = {
  Agents: _.extend(
    {
      url: require('./UrlAgent'),
      project_file: require('./ProjectFileAgent'),
      project_output_file: require('./ProjectOutputFileAgent'),
    },
    Modules.linkedFileAgentsIncludes()
  ),

  _getAgent(provider) {
    if (
      !Object.prototype.hasOwnProperty.call(
        LinkedFilesController.Agents,
        provider
      )
    ) {
      return null
    }
    if (!Array.from(Settings.enabledLinkedFileTypes).includes(provider)) {
      return null
    }
    return LinkedFilesController.Agents[provider]
  },

  createLinkedFile(req, res, next) {
    const { project_id: projectId } = req.params
    const { name, provider, data, parent_folder_id: parentFolderId } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)

    const Agent = LinkedFilesController._getAgent(provider)
    if (Agent == null) {
      return res.sendStatus(400)
    }

    data.provider = provider

    return Agent.createLinkedFile(
      projectId,
      data,
      name,
      parentFolderId,
      userId,
      function (err, newFileId) {
        if (err != null) {
          return LinkedFilesController.handleError(err, req, res, next)
        }
        return res.json({ new_file_id: newFileId })
      }
    )
  },

  refreshLinkedFile(req, res, next) {
    const { project_id: projectId, file_id: fileId } = req.params
    const userId = SessionManager.getLoggedInUserId(req.session)

    return LinkedFilesHandler.getFileById(
      projectId,
      fileId,
      function (err, file, path, parentFolder) {
        if (err != null) {
          return next(err)
        }
        if (file == null) {
          return res.sendStatus(404)
        }
        const { name } = file
        const { linkedFileData } = file
        if (
          linkedFileData == null ||
          (linkedFileData != null ? linkedFileData.provider : undefined) == null
        ) {
          return res.sendStatus(409)
        }
        const { provider } = linkedFileData
        const parentFolderId = parentFolder._id
        const Agent = LinkedFilesController._getAgent(provider)
        if (Agent == null) {
          return res.sendStatus(400)
        }

        return Agent.refreshLinkedFile(
          projectId,
          linkedFileData,
          name,
          parentFolderId,
          userId,
          function (err, newFileId) {
            if (err != null) {
              return LinkedFilesController.handleError(err, req, res, next)
            }
            return res.json({ new_file_id: newFileId })
          }
        )
      }
    )
  },

  handleError(error, req, res, next) {
    if (error instanceof AccessDeniedError) {
      res.status(403)
      plainTextResponse(
        res,
        res.locals.translate(
          'the_project_that_contains_this_file_is_not_shared_with_you'
        )
      )
    } else if (error instanceof BadDataError) {
      res.status(400)
      plainTextResponse(res, 'The submitted data is not valid')
    } else if (error instanceof BadEntityTypeError) {
      res.status(400)
      plainTextResponse(res, 'The file is the wrong type')
    } else if (error instanceof SourceFileNotFoundError) {
      res.status(404)
      plainTextResponse(res, 'Source file not found')
    } else if (error instanceof ProjectNotFoundError) {
      res.status(404)
      plainTextResponse(res, 'Project not found')
    } else if (error instanceof V1ProjectNotFoundError) {
      res.status(409)
      plainTextResponse(
        res,
        'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
      )
    } else if (error instanceof CompileFailedError) {
      res.status(422)
      plainTextResponse(
        res,
        res.locals.translate('generic_linked_file_compile_error')
      )
    } else if (error instanceof OutputFileFetchFailedError) {
      res.status(404)
      plainTextResponse(res, 'Could not get output file')
    } else if (error instanceof UrlFetchFailedError) {
      res.status(422)
      plainTextResponse(
        res,
        `Your URL could not be reached (${error.statusCode} status code). Please check it and try again.`
      )
    } else if (error instanceof InvalidUrlError) {
      res.status(422)
      plainTextResponse(
        res,
        'Your URL is not valid. Please check it and try again.'
      )
    } else if (error instanceof NotOriginalImporterError) {
      res.status(400)
      plainTextResponse(
        res,
        'You are not the user who originally imported this file'
      )
    } else if (error instanceof FeatureNotAvailableError) {
      res.status(400)
      plainTextResponse(res, 'This feature is not enabled on your account')
    } else if (error instanceof RemoteServiceError) {
      if (error.info?.statusCode === 403) {
        res.status(400).json({ relink: true })
      } else {
        res.status(502)
        plainTextResponse(res, 'The remote service produced an error')
      }
    } else if (error instanceof FileCannotRefreshError) {
      res.status(400)
      plainTextResponse(res, 'This file cannot be refreshed')
    } else if (error.message === 'project_has_too_many_files') {
      res.status(400)
      plainTextResponse(res, 'too many files')
    } else if (/\bECONNREFUSED\b/.test(error.message)) {
      res.status(500)
      plainTextResponse(res, 'Importing references is not currently available')
    } else {
      next(error)
    }
  },
}
