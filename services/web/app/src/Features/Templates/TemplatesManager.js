const { Project } = require('../../models/Project')
const OError = require('@overleaf/o-error')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const ProjectUploadManager = require('../Uploads/ProjectUploadManager')
const async = require('async')
const fs = require('fs')
const util = require('util')
const logger = require('@overleaf/logger')
const { fetchJson, RequestFailedError } = require('@overleaf/fetch-utils')
const request = require('request')
const settings = require('@overleaf/settings')
const crypto = require('crypto')
const Errors = require('../Errors/Errors')
const _ = require('lodash')

const TemplatesManager = {
  createProjectFromV1Template(
    brandVariationId,
    compiler,
    mainFile,
    templateId,
    templateName,
    templateVersionId,
    userId,
    imageName,
    _callback
  ) {
    const callback = _.once(_callback)
    const zipUrl = `${settings.apis.v1.url}/api/v1/overleaf/templates/${templateVersionId}`
    const zipReq = request(zipUrl, {
      auth: {
        user: settings.apis.v1.user,
        pass: settings.apis.v1.pass,
      },
      timeout: settings.apis.v1.timeout,
    })
    zipReq.on('error', function (err) {
      logger.warn({ err }, 'error getting zip from template API')
      return callback(err)
    })

    const projectName = ProjectDetailsHandler.fixProjectName(templateName)
    const dumpPath = `${settings.path.dumpFolder}/${crypto.randomUUID()}`
    const writeStream = fs.createWriteStream(dumpPath)
    const attributes = {
      fromV1TemplateId: templateId,
      fromV1TemplateVersionId: templateVersionId,
    }
    writeStream.on('close', function () {
      if (zipReq.response.statusCode !== 200) {
        logger.warn(
          { uri: zipUrl, statusCode: zipReq.response.statusCode },
          'non-success code getting zip from template API'
        )
        return callback(new Error('get zip failed'))
      }
      ProjectUploadManager.createProjectFromZipArchiveWithName(
        userId,
        projectName,
        dumpPath,
        attributes,
        function (err, project) {
          if (err) {
            OError.tag(err, 'problem building project from zip', {
              zipReq,
            })
            return callback(err)
          }
          async.series(
            [
              cb => TemplatesManager._setCompiler(project._id, compiler, cb),
              cb => TemplatesManager._setImage(project._id, imageName, cb),
              cb => TemplatesManager._setMainFile(project._id, mainFile, cb),
              cb =>
                TemplatesManager._setBrandVariationId(
                  project._id,
                  brandVariationId,
                  cb
                ),
            ],
            function (err) {
              if (err) {
                return callback(err)
              }
              fs.unlink(dumpPath, function (err) {
                if (err) {
                  return logger.err({ err }, 'error unlinking template zip')
                }
              })
              const update = {
                fromV1TemplateId: templateId,
                fromV1TemplateVersionId: templateVersionId,
              }
              Project.updateOne(
                { _id: project._id },
                update,
                {},
                function (err) {
                  if (err) {
                    return callback(err)
                  }
                  callback(null, project)
                }
              )
            }
          )
        }
      )
    })
    zipReq.pipe(writeStream)
  },

  _setCompiler(projectId, compiler, callback) {
    if (compiler == null) {
      return callback()
    }
    ProjectOptionsHandler.setCompiler(projectId, compiler, callback)
  },

  _setImage(projectId, imageName, callback) {
    if (!imageName) {
      imageName = 'wl_texlive:2018.1'
    }
    ProjectOptionsHandler.setImageName(projectId, imageName, callback)
  },

  _setMainFile(projectId, mainFile, callback) {
    if (mainFile == null) {
      return callback()
    }
    ProjectRootDocManager.setRootDocFromName(projectId, mainFile, callback)
  },

  _setBrandVariationId(projectId, brandVariationId, callback) {
    if (brandVariationId == null) {
      return callback()
    }
    ProjectOptionsHandler.setBrandVariationId(
      projectId,
      brandVariationId,
      callback
    )
  },

  promises: {
    async fetchFromV1(templateId) {
      const url = new URL(
        `/api/v2/templates/${templateId}`,
        settings.apis.v1.url
      )

      try {
        return await fetchJson(url, {
          basicAuth: {
            user: settings.apis.v1.user,
            password: settings.apis.v1.pass,
          },
          signal: AbortSignal.timeout(settings.apis.v1.timeout),
        })
      } catch (err) {
        if (err instanceof RequestFailedError && err.response.status === 404) {
          throw new Errors.NotFoundError()
        } else {
          throw err
        }
      }
    },
  },
}

TemplatesManager.fetchFromV1 = util.callbackify(
  TemplatesManager.promises.fetchFromV1
)
module.exports = TemplatesManager
