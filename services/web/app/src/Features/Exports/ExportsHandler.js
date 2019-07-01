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
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ExportsHandler, self
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectHistoryHandler = require('../Project/ProjectHistoryHandler')
const ProjectLocator = require('../Project/ProjectLocator')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const UserGetter = require('../User/UserGetter')
const logger = require('logger-sharelatex')
let settings = require('settings-sharelatex')
const async = require('async')
let request = require('request')
request = request.defaults()
settings = require('settings-sharelatex')

module.exports = ExportsHandler = self = {
  exportProject(export_params, callback) {
    if (callback == null) {
      callback = function(error, export_data) {}
    }
    return self._buildExport(export_params, function(err, export_data) {
      if (err != null) {
        return callback(err)
      }
      return self._requestExport(export_data, function(err, export_v1_id) {
        if (err != null) {
          return callback(err)
        }
        export_data.v1_id = export_v1_id
        // TODO: possibly store the export data in Mongo
        return callback(null, export_data)
      })
    })
  },

  _buildExport(export_params, callback) {
    if (callback == null) {
      callback = function(err, export_data) {}
    }
    const {
      project_id,
      user_id,
      brand_variation_id,
      title,
      description,
      author,
      license,
      show_source
    } = export_params
    const jobs = {
      project(cb) {
        return ProjectGetter.getProject(project_id, cb)
      },
      // TODO: when we update async, signature will change from (cb, results) to (results, cb)
      rootDoc: [
        'project',
        (cb, results) =>
          ProjectRootDocManager.ensureRootDocumentIsValid(project_id, function(
            error
          ) {
            if (error != null) {
              return callback(error)
            }
            return ProjectLocator.findRootDoc(
              { project: results.project, project_id },
              cb
            )
          })
      ],
      user(cb) {
        return UserGetter.getUser(
          user_id,
          { first_name: 1, last_name: 1, email: 1, overleaf: 1 },
          cb
        )
      },
      historyVersion(cb) {
        return ProjectHistoryHandler.ensureHistoryExistsForProject(
          project_id,
          function(error) {
            if (error != null) {
              return callback(error)
            }
            return self._requestVersion(project_id, cb)
          }
        )
      }
    }

    return async.auto(jobs, function(err, results) {
      if (err != null) {
        logger.warn(
          { err, project_id, user_id, brand_variation_id },
          'error building project export'
        )
        return callback(err)
      }

      const { project, rootDoc, user, historyVersion } = results
      if (rootDoc[1] == null) {
        err = new Error('cannot export project without root doc')
        logger.warn({ err, project_id })
        return callback(err)
      }

      if (export_params.first_name && export_params.last_name) {
        user.first_name = export_params.first_name
        user.last_name = export_params.last_name
      }

      const export_data = {
        project: {
          id: project_id,
          rootDocPath: rootDoc[1] != null ? rootDoc[1].fileSystem : undefined,
          historyId: __guard__(
            project.overleaf != null ? project.overleaf.history : undefined,
            x => x.id
          ),
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
            showSource: show_source
          }
        },
        user: {
          id: user_id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          orcidId: null, // until v2 gets ORCID
          v1UserId: user.overleaf != null ? user.overleaf.id : undefined
        },
        destination: {
          brandVariationId: brand_variation_id
        },
        options: {
          callbackUrl: null
        } // for now, until we want v1 to call us back
      }
      return callback(null, export_data)
    })
  },

  _requestExport(export_data, callback) {
    if (callback == null) {
      callback = function(err, export_v1_id) {}
    }
    return request.post(
      {
        url: `${settings.apis.v1.url}/api/v1/sharelatex/exports`,
        auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
        json: export_data
      },
      function(err, res, body) {
        if (err != null) {
          logger.warn(
            { err, export: export_data },
            'error making request to v1 export'
          )
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body.exportId)
        } else {
          logger.warn(
            { export: export_data },
            `v1 export returned failure; forwarding: ${body}`
          )
          // pass the v1 error along for the publish modal to handle
          return callback({ forwardResponse: body })
        }
      }
    )
  },

  _requestVersion(project_id, callback) {
    if (callback == null) {
      callback = function(err, export_v1_id) {}
    }
    return request.get(
      {
        url: `${
          settings.apis.project_history.url
        }/project/${project_id}/version`,
        json: true
      },
      function(err, res, body) {
        if (err != null) {
          logger.warn(
            { err, project_id },
            'error making request to project history'
          )
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body.version)
        } else {
          err = new Error(
            `project history version returned a failure status code: ${
              res.statusCode
            }`
          )
          logger.warn(
            { err, project_id },
            `project history version returned failure status code: ${
              res.statusCode
            }`
          )
          return callback(err)
        }
      }
    )
  },

  fetchExport(export_id, callback) {
    if (callback == null) {
      callback = function(err, export_json) {}
    }
    return request.get(
      {
        url: `${settings.apis.v1.url}/api/v1/sharelatex/exports/${export_id}`,
        auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass }
      },
      function(err, res, body) {
        if (err != null) {
          logger.warn(
            { err, export: export_id },
            'error making request to v1 export'
          )
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body)
        } else {
          err = new Error(
            `v1 export returned a failure status code: ${res.statusCode}`
          )
          logger.warn(
            { err, export: export_id },
            `v1 export returned failure status code: ${res.statusCode}`
          )
          return callback(err)
        }
      }
    )
  },

  fetchDownload(export_id, type, callback) {
    if (callback == null) {
      callback = function(err, file_url) {}
    }
    return request.get(
      {
        url: `${
          settings.apis.v1.url
        }/api/v1/sharelatex/exports/${export_id}/${type}_url`,
        auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass }
      },
      function(err, res, body) {
        if (err != null) {
          logger.warn(
            { err, export: export_id },
            'error making request to v1 export'
          )
          return callback(err)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null, body)
        } else {
          err = new Error(
            `v1 export returned a failure status code: ${res.statusCode}`
          )
          logger.warn(
            { err, export: export_id },
            `v1 export zip fetch returned failure status code: ${
              res.statusCode
            }`
          )
          return callback(err)
        }
      }
    )
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
