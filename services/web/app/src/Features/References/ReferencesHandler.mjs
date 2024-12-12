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
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import OError from '@overleaf/o-error'
import logger from '@overleaf/logger'
import request from 'request'
import settings from '@overleaf/settings'
import Features from '../../infrastructure/Features.js'
import ProjectGetter from '../Project/ProjectGetter.js'
import UserGetter from '../User/UserGetter.js'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.js'
import _ from 'lodash'
import Async from 'async'
import Errors from '../Errors/Errors.js'
import { promisify } from '@overleaf/promise-utils'
import HistoryURLHelper from '../History/HistoryURLHelper.js'

let ReferencesHandler

if (!Features.hasFeature('references')) {
  logger.debug('references search not enabled')
}

export default ReferencesHandler = {
  _buildDocUrl(projectId, docId) {
    return {
      url: `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}/raw`,
    }
  },

  _findBibFileRefs(project) {
    const fileRefs = []
    function _process(folder) {
      _.forEach(folder.fileRefs || [], function (file) {
        if (
          __guard__(file != null ? file.name : undefined, x1 =>
            x1.match(/^.*\.bib$/)
          )
        ) {
          return fileRefs.push(file)
        }
      })
      return _.forEach(folder.folders || [], folder => _process(folder))
    }
    _.forEach(project.rootFolder || [], rootFolder => _process(rootFolder))
    return fileRefs
  },

  _findBibDocIds(project) {
    const ids = []
    function _process(folder) {
      _.forEach(folder.docs || [], function (doc) {
        if (
          __guard__(doc != null ? doc.name : undefined, x1 =>
            x1.match(/^.*\.bib$/)
          )
        ) {
          return ids.push(doc._id)
        }
      })
      return _.forEach(folder.folders || [], folder => _process(folder))
    }
    _.forEach(project.rootFolder || [], rootFolder => _process(rootFolder))
    return ids
  },

  _isFullIndex(project, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return UserGetter.getUser(
      project.owner_ref,
      { features: true },
      function (err, owner) {
        if (err != null) {
          return callback(err)
        }
        const features = owner != null ? owner.features : undefined
        return callback(
          null,
          (features != null ? features.references : undefined) === true ||
            (features != null ? features.referencesSearch : undefined) === true
        )
      }
    )
  },

  indexAll(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ProjectGetter.getProject(
      projectId,
      { rootFolder: true, owner_ref: 1, 'overleaf.history.id': 1 },
      function (err, project) {
        if (err) {
          OError.tag(err, 'error finding project', {
            projectId,
          })
          return callback(err)
        }
        if (!project) {
          return callback(
            new Errors.NotFoundError(`project does not exist: ${projectId}`)
          )
        }
        logger.debug({ projectId }, 'indexing all bib files in project')
        const docIds = ReferencesHandler._findBibDocIds(project)
        const fileRefs = ReferencesHandler._findBibFileRefs(project)
        return ReferencesHandler._doIndexOperation(
          projectId,
          project,
          docIds,
          fileRefs,
          callback
        )
      }
    )
  },

  _doIndexOperation(projectId, project, docIds, fileRefs, callback) {
    if (!Features.hasFeature('references')) {
      return callback()
    }
    const historyId = project?.overleaf?.history?.id
    if (!historyId) {
      return callback(
        new OError('project does not have a history id', { projectId })
      )
    }
    return ReferencesHandler._isFullIndex(project, function (err, isFullIndex) {
      if (err) {
        OError.tag(err, 'error checking whether to do full index', {
          projectId,
        })
        return callback(err)
      }
      logger.debug(
        { projectId, docIds },
        'flushing docs to mongo before calling references service'
      )
      return Async.series(
        docIds.map(
          docId => cb =>
            DocumentUpdaterHandler.flushDocToMongo(projectId, docId, cb)
        ),
        function (err) {
          // continue
          if (err) {
            OError.tag(err, 'error flushing docs to mongo', {
              projectId,
              docIds,
            })
            return callback(err)
          }
          const bibDocUrls = docIds.map(docId =>
            ReferencesHandler._buildDocUrl(projectId, docId)
          )
          const bibFileUrls = fileRefs.map(fileRef =>
            HistoryURLHelper.projectHistoryURLWithFilestoreFallback(
              settings,
              projectId,
              historyId,
              fileRef,
              'bibFileUrls'
            )
          )
          const sourceURLs = bibDocUrls.concat(bibFileUrls)
          return request.post(
            {
              url: `${settings.apis.references.url}/project/${projectId}/index`,
              json: {
                docUrls: sourceURLs.map(item => item.fallbackURL || item.url),
                sourceURLs,
                fullIndex: isFullIndex,
              },
            },
            function (err, res, data) {
              if (err) {
                OError.tag(err, 'error communicating with references api', {
                  projectId,
                })
                return callback(err)
              }
              if (res.statusCode >= 200 && res.statusCode < 300) {
                logger.debug({ projectId }, 'got keys from references api')
                return callback(null, data)
              } else {
                err = new Error(
                  `references api responded with non-success code: ${res.statusCode}`
                )
                return callback(err)
              }
            }
          )
        }
      )
    })
  },
}

ReferencesHandler.promises = {
  indexAll: promisify(ReferencesHandler.indexAll),
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
