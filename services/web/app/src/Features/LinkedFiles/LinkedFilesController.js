/* eslint-disable
    camelcase,
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
const AuthenticationController = require('../Authentication/AuthenticationController')
const EditorController = require('../Editor/EditorController')
const ProjectLocator = require('../Project/ProjectLocator')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const _ = require('underscore')
const LinkedFilesHandler = require('./LinkedFilesHandler')
const {
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
  FileCannotRefreshError
} = require('./LinkedFilesErrors')
const Modules = require('../../infrastructure/Modules')

module.exports = LinkedFilesController = {
  Agents: _.extend(
    {
      url: require('./UrlAgent'),
      project_file: require('./ProjectFileAgent'),
      project_output_file: require('./ProjectOutputFileAgent')
    },
    Modules.linkedFileAgentsIncludes()
  ),

  _getAgent(provider) {
    if (!LinkedFilesController.Agents.hasOwnProperty(provider)) {
      return null
    }
    if (!Array.from(Settings.enabledLinkedFileTypes).includes(provider)) {
      return null
    }
    return LinkedFilesController.Agents[provider]
  },

  createLinkedFile(req, res, next) {
    const { project_id } = req.params
    const { name, provider, data, parent_folder_id } = req.body
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log(
      { project_id, name, provider, data, parent_folder_id, user_id },
      'create linked file request'
    )

    const Agent = LinkedFilesController._getAgent(provider)
    if (Agent == null) {
      return res.sendStatus(400)
    }

    data.provider = provider

    return Agent.createLinkedFile(
      project_id,
      data,
      name,
      parent_folder_id,
      user_id,
      function(err, newFileId) {
        if (err != null) {
          return LinkedFilesController.handleError(err, req, res, next)
        }
        return res.json({ new_file_id: newFileId })
      }
    )
  },

  refreshLinkedFile(req, res, next) {
    const { project_id, file_id } = req.params
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log({ project_id, file_id, user_id }, 'refresh linked file request')

    return LinkedFilesHandler.getFileById(project_id, file_id, function(
      err,
      file,
      path,
      parentFolder
    ) {
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
        return res.send(409)
      }
      const { provider } = linkedFileData
      const parent_folder_id = parentFolder._id
      const Agent = LinkedFilesController._getAgent(provider)
      if (Agent == null) {
        return res.sendStatus(400)
      }

      return Agent.refreshLinkedFile(
        project_id,
        linkedFileData,
        name,
        parent_folder_id,
        user_id,
        function(err, newFileId) {
          if (err != null) {
            return LinkedFilesController.handleError(err, req, res, next)
          }
          return res.json({ new_file_id: newFileId })
        }
      )
    })
  },

  handleError(error, req, res, next) {
    if (error instanceof BadDataError) {
      return res.status(400).send('The submitted data is not valid')
    } else if (error instanceof AccessDeniedError) {
      return res.status(403).send('You do not have access to this project')
    } else if (error instanceof BadDataError) {
      return res.status(400).send('The submitted data is not valid')
    } else if (error instanceof BadEntityTypeError) {
      return res.status(400).send('The file is the wrong type')
    } else if (error instanceof SourceFileNotFoundError) {
      return res.status(404).send('Source file not found')
    } else if (error instanceof ProjectNotFoundError) {
      return res.status(404).send('Project not found')
    } else if (error instanceof V1ProjectNotFoundError) {
      return res
        .status(409)
        .send(
          'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
        )
    } else if (error instanceof OutputFileFetchFailedError) {
      return res.status(404).send('Could not get output file')
    } else if (error instanceof UrlFetchFailedError) {
      return res
        .status(422)
        .send(
          `Your URL could not be reached (${
            error.statusCode
          } status code). Please check it and try again.`
        )
    } else if (error instanceof InvalidUrlError) {
      return res
        .status(422)
        .send('Your URL is not valid. Please check it and try again.')
    } else if (error instanceof NotOriginalImporterError) {
      return res
        .status(400)
        .send('You are not the user who originally imported this file')
    } else if (error instanceof FeatureNotAvailableError) {
      return res.status(400).send('This feature is not enabled on your account')
    } else if (error instanceof RemoteServiceError) {
      return res.status(502).send('The remote service produced an error')
    } else if (error instanceof FileCannotRefreshError) {
      return res.status(400).send('This file cannot be refreshed')
    } else {
      return next(error)
    }
  }
}
