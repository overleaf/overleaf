/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-irregular-whitespace,
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
let tpdsUrl
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const path = require('path')
const ProjectGetter = require('../Project/ProjectGetter')
const keys = require('../../infrastructure/Keys')
const metrics = require('metrics-sharelatex')
const request = require('request')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const { promisifyAll } = require('../../util/promises')

const buildPath = function(user_id, project_name, filePath) {
  let projectPath = path.join(project_name, '/', filePath)
  projectPath = encodeURIComponent(projectPath)
  const fullPath = path.join('/user/', `${user_id}`, '/entity/', projectPath)
  return fullPath
}

const tpdsworkerEnabled = () =>
  (settings.apis.tpdsworker != null
    ? settings.apis.tpdsworker.url
    : undefined) != null
if (!tpdsworkerEnabled()) {
  logger.log('tpdsworker is not enabled, request will not be sent to it')
}

if (settings.apis.thirdPartyDataStore.linode_url != null) {
  tpdsUrl = settings.apis.thirdPartyDataStore.linode_url
} else {
  tpdsUrl = settings.apis.thirdPartyDataStore.url
}

const TpdsUpdateSender = {
  _enqueue(group, method, job, callback) {
    if (!tpdsworkerEnabled()) {
      return callback()
    }
    const opts = {
      uri: `${settings.apis.tpdsworker.url}/enqueue/web_to_tpds_http_requests`,
      json: {
        group,
        method,
        job
      },
      method: 'post',
      timeout: 5 * 1000
    }
    return request(opts, function(err) {
      if (err != null) {
        logger.err(
          { err },
          'error queuing something in the tpdsworker, continuing anyway'
        )
        return callback()
      } else {
        logger.log({ group, job }, 'successfully queued up job for tpdsworker')
        return callback()
      }
    })
  },

  _addEntity(options, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    return getProjectsUsersIds(options.project_id, function(
      err,
      user_id,
      allUserIds
    ) {
      if (err != null) {
        logger.warn({ err, options }, 'error getting projects user ids')
        return callback(err)
      }
      logger.log(
        {
          project_id: options.project_id,
          user_id,
          path: options.path,
          uri: options.uri,
          rev: options.rev
        },
        'sending file to third party data store'
      )
      const postOptions = {
        method: 'post',
        headers: {
          sl_entity_rev: options.rev,
          sl_project_id: options.project_id,
          sl_all_user_ids: JSON.stringify(allUserIds)
        },
        uri: `${tpdsUrl}${buildPath(
          user_id,
          options.project_name,
          options.path
        )}`,
        title: 'addFile',
        streamOrigin: options.streamOrigin
      }
      return TpdsUpdateSender._enqueue(
        options.project_id,
        'pipeStreamFrom',
        postOptions,
        function(err) {
          if (err != null) {
            logger.warn(
              {
                err,
                project_id: options.project_id,
                user_id,
                path: options.path,
                uri: options.uri,
                rev: options.rev
              },
              'error sending file to third party data store queued up for processing'
            )
            return callback(err)
          }
          logger.log(
            {
              project_id: options.project_id,
              user_id,
              path: options.path,
              uri: options.uri,
              rev: options.rev
            },
            'sending file to third party data store queued up for processing'
          )
          return callback(err)
        }
      )
    })
  },

  addFile(options, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    metrics.inc('tpds.add-file')
    options.streamOrigin =
      (settings.apis.filestore.linode_url || settings.apis.filestore.url) +
      path.join(`/project/${options.project_id}/file/`, `${options.file_id}`)
    return this._addEntity(options, callback)
  },

  addDoc(options, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    metrics.inc('tpds.add-doc')
    options.streamOrigin =
      (settings.apis.docstore.linode_url || settings.apis.docstore.pubUrl) +
      path.join(`/project/${options.project_id}/doc/`, `${options.doc_id}/raw`)
    return this._addEntity(options, callback)
  },
  moveEntity(options, callback) {
    let endPath, startPath
    if (callback == null) {
      callback = function(err) {}
    }
    metrics.inc('tpds.move-entity')
    if (options.newProjectName != null) {
      startPath = path.join(`/${options.project_name}/`)
      endPath = path.join(`/${options.newProjectName}/`)
    } else {
      startPath = mergeProjectNameAndPath(
        options.project_name,
        options.startPath
      )
      endPath = mergeProjectNameAndPath(options.project_name, options.endPath)
    }
    return getProjectsUsersIds(options.project_id, function(
      err,
      user_id,
      allUserIds
    ) {
      logger.log(
        {
          project_id: options.project_id,
          user_id,
          startPath,
          endPath,
          uri: options.uri
        },
        'moving entity in third party data store'
      )
      const moveOptions = {
        method: 'put',
        title: 'moveEntity',
        uri: `${tpdsUrl}/user/${user_id}/entity`,
        headers: {
          sl_project_id: options.project_id,
          sl_entity_rev: options.rev,
          sl_all_user_ids: JSON.stringify(allUserIds)
        },
        json: {
          user_id,
          endPath,
          startPath
        }
      }
      return TpdsUpdateSender._enqueue(
        options.project_id,
        'standardHttpRequest',
        moveOptions,
        callback
      )
    })
  },

  deleteEntity(options, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    metrics.inc('tpds.delete-entity')
    return getProjectsUsersIds(options.project_id, function(
      err,
      user_id,
      allUserIds
    ) {
      logger.log(
        {
          project_id: options.project_id,
          user_id,
          path: options.path,
          uri: options.uri
        },
        'deleting entity in third party data store'
      )
      const deleteOptions = {
        method: 'DELETE',
        headers: {
          sl_project_id: options.project_id,
          sl_all_user_ids: JSON.stringify(allUserIds)
        },
        uri: `${tpdsUrl}${buildPath(
          user_id,
          options.project_name,
          options.path
        )}`,
        title: 'deleteEntity',
        sl_all_user_ids: JSON.stringify(allUserIds)
      }
      return TpdsUpdateSender._enqueue(
        options.project_id,
        'standardHttpRequest',
        deleteOptions,
        callback
      )
    })
  },

  pollDropboxForUser(user_id, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    metrics.inc('tpds.poll-dropbox')
    logger.log({ user_id }, 'polling dropbox for user')
    const options = {
      method: 'POST',
      uri: `${tpdsUrl}/user/poll`,
      json: {
        user_ids: [user_id]
      }
    }
    return TpdsUpdateSender._enqueue(
      `poll-dropbox:${user_id}`,
      'standardHttpRequest',
      options,
      callback
    )
  }
}

var getProjectsUsersIds = function(project_id, callback) {
  if (callback == null) {
    callback = function(err, owner_id, allUserIds) {}
  }
  return ProjectGetter.getProject(
    project_id,
    { _id: true, owner_ref: true },
    function(err, project) {
      if (err != null) {
        return callback(err)
      }
      return CollaboratorsHandler.getInvitedMemberIds(project_id, function(
        err,
        member_ids
      ) {
        if (err != null) {
          return callback(err)
        }
        return callback(
          err,
          project != null ? project.owner_ref : undefined,
          member_ids
        )
      })
    }
  )
}

var mergeProjectNameAndPath = function(project_name, path) {
  if (path.indexOf('/') === 0) {
    path = path.substring(1)
  }
  const fullPath = `/${project_name}/${path}`
  return fullPath
}

TpdsUpdateSender.promises = promisifyAll(TpdsUpdateSender)
module.exports = TpdsUpdateSender
