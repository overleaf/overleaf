/* eslint-disable
    n/handle-callback-err,
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
import OError from '@overleaf/o-error'
import ProjectGetter from '../Project/ProjectGetter.js'
import ProjectHistoryHandler from '../Project/ProjectHistoryHandler.js'
import ProjectLocator from '../Project/ProjectLocator.js'
import ProjectRootDocManager from '../Project/ProjectRootDocManager.js'
import UserGetter from '../User/UserGetter.js'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import async from 'async'
import Request from 'request'
let ExportsHandler
const request = Request.defaults()

export default ExportsHandler = {
  exportProject(exportParams, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ExportsHandler._buildExport(
      exportParams,
      function (err, exportData) {
        if (err != null) {
          return callback(err)
        }
        return ExportsHandler._requestExport(exportData, function (err, body) {
          if (err != null) {
            return callback(err)
          }
          exportData.v1_id = body.exportId
          exportData.message = body.message
          // TODO: possibly store the export data in Mongo
          return callback(null, exportData)
        })
      }
    )
  },

  _buildExport(exportParams, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const {
      project_id: projectId,
      user_id: userId,
      brand_variation_id: brandVariationId,
      title,
      description,
      author,
      license,
      show_source: showSource,
    } = exportParams
    const jobs = {
      project(cb) {
        return ProjectGetter.getProject(projectId, cb)
      },
      rootDoc: [
        'project',
        (results, cb) =>
          ProjectRootDocManager.ensureRootDocumentIsValid(
            projectId,
            function (error) {
              if (error != null) {
                return callback(error)
              }
              return ProjectLocator.findRootDoc(
                { project: results.project, project_id: projectId },
                cb
              )
            }
          ),
      ],
      user(cb) {
        return UserGetter.getUser(
          userId,
          { first_name: 1, last_name: 1, email: 1, overleaf: 1 },
          cb
        )
      },
      historyVersion(cb) {
        return ProjectHistoryHandler.ensureHistoryExistsForProject(
          projectId,
          function (error) {
            if (error != null) {
              return callback(error)
            }
            return ExportsHandler._requestVersion(projectId, cb)
          }
        )
      },
    }

    return async.auto(jobs, function (err, results) {
      if (err != null) {
        OError.tag(err, 'error building project export', {
          project_id: projectId,
          user_id: userId,
          brand_variation_id: brandVariationId,
        })
        return callback(err)
      }

      const { project, rootDoc, user, historyVersion } = results
      if (!rootDoc || rootDoc[1] == null) {
        err = new OError('cannot export project without root doc', {
          project_id: projectId,
        })
        return callback(err)
      }

      if (exportParams.first_name && exportParams.last_name) {
        user.first_name = exportParams.first_name
        user.last_name = exportParams.last_name
      }

      const exportData = {
        project: {
          id: projectId,
          rootDocPath: rootDoc[1] != null ? rootDoc[1].fileSystem : undefined,
          historyId: project.overleaf?.history?.id,
          historyVersion,
          v1ProjectId:
            project.overleaf != null ? project.overleaf.id : undefined,
          metadata: {
            compiler: project.compiler,
            imageName: project.imageName,
            title,
            description,
            author,
            license,
            showSource,
          },
        },
        user: {
          id: userId,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          orcidId: null, // until v2 gets ORCID
          v1UserId: user.overleaf != null ? user.overleaf.id : undefined,
        },
        destination: {
          brandVariationId,
        },
        options: {
          callbackUrl: null,
        }, // for now, until we want v1 to call us back
      }
      return callback(null, exportData)
    })
  },

  _requestExport(exportData, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.post(
      {
        url: `${settings.apis.v1.url}/api/v1/overleaf/exports`,
        auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
        json: exportData,
        timeout: settings.apis.v1.timeout,
      },
      function (err, res, body) {
        if (err != null) {
          OError.tag(err, 'error making request to v1 export', {
            export: exportData,
          })
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body)
        } else {
          logger.warn(
            { export: exportData },
            `v1 export returned failure; forwarding: ${body}`
          )
          // pass the v1 error along for the publish modal to handle
          const err = { forwardResponse: body }
          return callback(err)
        }
      }
    )
  },

  _requestVersion(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `${settings.apis.project_history.url}/project/${projectId}/version`,
        json: true,
      },
      function (err, res, body) {
        if (err != null) {
          OError.tag(err, 'error making request to project history', {
            project_id: projectId,
          })
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body.version)
        } else {
          err = new OError(
            `project history version returned a failure status code: ${res.statusCode}`,
            { project_id: projectId }
          )
          return callback(err)
        }
      }
    )
  },

  fetchExport(exportId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `${settings.apis.v1.url}/api/v1/overleaf/exports/${exportId}`,
        auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
        timeout: settings.apis.v1.timeout,
      },
      function (err, res, body) {
        if (err != null) {
          OError.tag(err, 'error making request to v1 export', {
            export: exportId,
          })
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body)
        } else {
          err = new OError(
            `v1 export returned a failure status code: ${res.statusCode}`,
            { export: exportId }
          )
          return callback(err)
        }
      }
    )
  },

  fetchDownload(exportId, type, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `${settings.apis.v1.url}/api/v1/overleaf/exports/${exportId}/${type}_url`,
        auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
        timeout: settings.apis.v1.timeout,
      },
      function (err, res, body) {
        if (err != null) {
          OError.tag(err, 'error making request to v1 export', {
            export: exportId,
          })
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body)
        } else {
          err = new OError(
            `v1 export returned a failure status code: ${res.statusCode}`,
            { export: exportId }
          )
          return callback(err)
        }
      }
    )
  },
}
