/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { Project } = require('../../models/Project')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const ProjectUploadManager = require('../Uploads/ProjectUploadManager')
const FileWriter = require('../../infrastructure/FileWriter')
const async = require('async')
const fs = require('fs')
const util = require('util')
const logger = require('logger-sharelatex')
const request = require('request')
const requestPromise = require('request-promise-native')
const settings = require('settings-sharelatex')
const uuid = require('uuid')
const Errors = require('../Errors/Errors')
const _ = require('underscore')

const TemplatesManager = {
  createProjectFromV1Template(
    brandVariationId,
    compiler,
    mainFile,
    templateId,
    templateName,
    templateVersionId,
    user_id,
    imageName,
    _callback
  ) {
    const callback = _.once(_callback)
    const zipUrl = `${
      settings.apis.v1.url
    }/api/v1/sharelatex/templates/${templateVersionId}`
    const zipReq = request(zipUrl, {
      auth: {
        user: settings.apis.v1.user,
        pass: settings.apis.v1.pass
      },
      timeout: 60 * 1000
    })
    zipReq.on('error', function(err) {
      logger.warn({ err }, 'error getting zip from template API')
      return callback(err)
    })
    return FileWriter.ensureDumpFolderExists(function(err) {
      if (err != null) {
        return callback(err)
      }

      const projectName = ProjectDetailsHandler.fixProjectName(templateName)
      const dumpPath = `${settings.path.dumpFolder}/${uuid.v4()}`
      const writeStream = fs.createWriteStream(dumpPath)
      const attributes = {
        fromV1TemplateId: templateId,
        fromV1TemplateVersionId: templateVersionId
      }
      writeStream.on('close', function() {
        if (zipReq.response.statusCode !== 200) {
          logger.warn(
            { uri: zipUrl, statusCode: zipReq.response.statusCode },
            'non-success code getting zip from template API'
          )
          return callback(new Error('get zip failed'))
        }
        return ProjectUploadManager.createProjectFromZipArchiveWithName(
          user_id,
          projectName,
          dumpPath,
          attributes,
          function(err, project) {
            if (err != null) {
              logger.warn({ err, zipReq }, 'problem building project from zip')
              return callback(err)
            }
            return async.series(
              [
                cb => TemplatesManager._setCompiler(project._id, compiler, cb),
                cb => TemplatesManager._setImage(project._id, imageName, cb),
                cb => TemplatesManager._setMainFile(project._id, mainFile, cb),
                cb =>
                  TemplatesManager._setBrandVariationId(
                    project._id,
                    brandVariationId,
                    cb
                  )
              ],
              function(err) {
                if (err != null) {
                  return callback(err)
                }
                fs.unlink(dumpPath, function(err) {
                  if (err != null) {
                    return logger.err({ err }, 'error unlinking template zip')
                  }
                })
                const update = {
                  fromV1TemplateId: templateId,
                  fromV1TemplateVersionId: templateVersionId
                }
                return Project.update(
                  { _id: project._id },
                  update,
                  {},
                  function(err) {
                    if (err != null) {
                      return callback(err)
                    }
                    return callback(null, project)
                  }
                )
              }
            )
          }
        )
      })
      return zipReq.pipe(writeStream)
    })
  },

  _setCompiler(project_id, compiler, callback) {
    if (compiler == null) {
      return callback()
    }
    return ProjectOptionsHandler.setCompiler(project_id, compiler, callback)
  },

  _setImage(project_id, imageName, callback) {
    if (!imageName) {
      imageName = 'wl_texlive:2018.1'
    }
    return ProjectOptionsHandler.setImageName(project_id, imageName, callback)
  },

  _setMainFile(project_id, mainFile, callback) {
    if (mainFile == null) {
      return callback()
    }
    return ProjectRootDocManager.setRootDocFromName(
      project_id,
      mainFile,
      callback
    )
  },

  _setBrandVariationId(project_id, brandVariationId, callback) {
    if (brandVariationId == null) {
      return callback()
    }
    return ProjectOptionsHandler.setBrandVariationId(
      project_id,
      brandVariationId,
      callback
    )
  },

  promises: {
    async fetchFromV1(templateId) {
      let { body, statusCode } = await requestPromise({
        baseUrl: settings.apis.v1.url,
        url: `/api/v2/templates/${templateId}`,
        method: 'GET',
        auth: {
          user: settings.apis.v1.user,
          pass: settings.apis.v1.pass,
          sendImmediately: true
        },
        resolveWithFullResponse: true,
        simple: false,
        json: true,
        timeout: 60 * 1000
      })

      if (statusCode === 404) {
        throw new Errors.NotFoundError()
      }

      if (statusCode !== 200) {
        logger.warn(
          { templateId },
          "[TemplateMetrics] Couldn't fetch template data from v1"
        )
        throw new Error("Couldn't fetch template data from v1")
      }

      return body
    }
  }
}

TemplatesManager.fetchFromV1 = util.callbackify(
  TemplatesManager.promises.fetchFromV1
)
module.exports = TemplatesManager
