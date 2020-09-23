const { ObjectId } = require('mongodb')
const _ = require('lodash')
const { callbackify } = require('util')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const path = require('path')
const request = require('request-promise-native')
const settings = require('settings-sharelatex')

const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
  .promises
const UserGetter = require('../User/UserGetter.js').promises

const tpdsUrl = _.get(settings, ['apis', 'thirdPartyDataStore', 'url'])

async function addDoc(options) {
  metrics.inc('tpds.add-doc')

  options.streamOrigin =
    settings.apis.docstore.pubUrl +
    path.join(
      `/project/${options.project_id}`,
      `/doc/${options.doc_id}`,
      '/raw'
    )

  return addEntity(options)
}

async function addEntity(options) {
  const projectUserIds = await getProjectUsersIds(options.project_id)

  for (const userId of projectUserIds) {
    const job = {
      method: 'post',
      headers: {
        sl_entity_rev: options.rev,
        sl_project_id: options.project_id,
        sl_all_user_ids: JSON.stringify([userId]),
        sl_project_owner_user_id: projectUserIds[0]
      },
      uri: buildTpdsUrl(userId, options.project_name, options.path),
      title: 'addFile',
      streamOrigin: options.streamOrigin
    }

    await enqueue(userId, 'pipeStreamFrom', job)
  }
}

async function addFile(options) {
  metrics.inc('tpds.add-file')

  options.streamOrigin =
    settings.apis.filestore.url +
    path.join(`/project/${options.project_id}`, `/file/${options.file_id}`)

  return addEntity(options)
}

function buildMovePaths(options) {
  if (options.newProjectName) {
    return {
      startPath: path.join('/', options.project_name, '/'),
      endPath: path.join('/', options.newProjectName, '/')
    }
  } else {
    return {
      startPath: path.join('/', options.project_name, '/', options.startPath),
      endPath: path.join('/', options.project_name, '/', options.endPath)
    }
  }
}

function buildTpdsUrl(userId, projectName, filePath) {
  const projectPath = encodeURIComponent(path.join(projectName, '/', filePath))
  return `${tpdsUrl}/user/${userId}/entity/${projectPath}`
}

async function deleteEntity(options) {
  metrics.inc('tpds.delete-entity')

  const projectUserIds = await getProjectUsersIds(options.project_id)

  for (const userId of projectUserIds) {
    const job = {
      method: 'delete',
      headers: {
        sl_project_id: options.project_id,
        sl_all_user_ids: JSON.stringify([userId]),
        sl_project_owner_user_id: projectUserIds[0]
      },
      uri: buildTpdsUrl(userId, options.project_name, options.path),
      title: 'deleteEntity',
      sl_all_user_ids: JSON.stringify([userId])
    }

    await enqueue(userId, 'standardHttpRequest', job)
  }
}

async function enqueue(group, method, job) {
  const tpdsWorkerUrl = _.get(settings, ['apis', 'tpdsworker', 'url'])
  // silently do nothing if worker url is not in settings
  if (!tpdsWorkerUrl) {
    return
  }
  try {
    const response = await request({
      uri: `${tpdsWorkerUrl}/enqueue/web_to_tpds_http_requests`,
      json: { group, job, method },
      method: 'post',
      timeout: 5 * 1000
    })
    return response
  } catch (err) {
    // log error and continue
    logger.error({ err, group, job, method }, 'error enqueueing tpdsworker job')
  }
}

async function getProjectUsersIds(projectId) {
  // get list of all user ids with access to project. project owner
  // will always be the first entry in the list.
  const [
    ownerUserId,
    ...invitedUserIds
  ] = await CollaboratorsGetter.getInvitedMemberIds(projectId)
  // if there are no invited users, always return the owner
  if (!invitedUserIds.length) {
    return [ownerUserId]
  }
  // filter invited users to only return those with dropbox linked
  const dropboxUsers = await UserGetter.getUsers(
    {
      _id: { $in: invitedUserIds.map(id => ObjectId(id)) },
      'dropbox.access_token.uid': { $ne: null }
    },
    {
      _id: 1
    }
  )
  const dropboxUserIds = dropboxUsers.map(user => user._id)
  return [ownerUserId, ...dropboxUserIds]
}

async function moveEntity(options) {
  metrics.inc('tpds.move-entity')

  const projectUserIds = await getProjectUsersIds(options.project_id)
  const { endPath, startPath } = buildMovePaths(options)

  for (const userId of projectUserIds) {
    const job = {
      method: 'put',
      title: 'moveEntity',
      uri: `${tpdsUrl}/user/${userId}/entity`,
      headers: {
        sl_project_id: options.project_id,
        sl_entity_rev: options.rev,
        sl_all_user_ids: JSON.stringify([userId]),
        sl_project_owner_user_id: projectUserIds[0]
      },
      json: {
        user_id: userId,
        endPath,
        startPath
      }
    }

    await enqueue(userId, 'standardHttpRequest', job)
  }
}

async function pollDropboxForUser(userId) {
  metrics.inc('tpds.poll-dropbox')

  const job = {
    method: 'post',
    uri: `${tpdsUrl}/user/poll`,
    json: {
      user_ids: [userId]
    }
  }

  return enqueue(`poll-dropbox:${userId}`, 'standardHttpRequest', job)
}

const TpdsUpdateSender = {
  addDoc: callbackify(addDoc),
  addEntity: callbackify(addEntity),
  addFile: callbackify(addFile),
  deleteEntity: callbackify(deleteEntity),
  enqueue: callbackify(enqueue),
  moveEntity: callbackify(moveEntity),
  pollDropboxForUser: callbackify(pollDropboxForUser),
  promises: {
    addDoc,
    addEntity,
    addFile,
    deleteEntity,
    enqueue,
    moveEntity,
    pollDropboxForUser
  }
}

module.exports = TpdsUpdateSender
