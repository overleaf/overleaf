const { ObjectId } = require('mongodb')
const _ = require('lodash')
const { callbackify } = require('util')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const Path = require('path')
const fetch = require('node-fetch')
const settings = require('@overleaf/settings')

const CollaboratorsGetter =
  require('../Collaborators/CollaboratorsGetter').promises
const UserGetter = require('../User/UserGetter.js').promises

const tpdsUrl = _.get(settings, ['apis', 'thirdPartyDataStore', 'url'])

async function addDoc(params) {
  metrics.inc('tpds.add-doc')
  const { projectId, path, docId, projectName, rev, folderId } = params

  const streamOrigin =
    settings.apis.docstore.pubUrl +
    Path.join(`/project/${projectId}`, `/doc/${docId}`, '/raw')

  await addEntity({
    projectId,
    path,
    projectName,
    rev,
    folderId,
    streamOrigin,
    entityId: docId,
    entityType: 'doc',
  })
}

async function addEntity(params) {
  const {
    projectId,
    path,
    projectName,
    rev,
    folderId,
    streamOrigin,
    entityId,
    entityType,
  } = params

  const projectUserIds = await getProjectUsersIds(projectId)

  for (const userId of projectUserIds) {
    const job = {
      method: 'post',
      headers: {
        sl_entity_id: entityId,
        sl_entity_type: entityType,
        sl_entity_rev: rev,
        sl_project_id: projectId,
        sl_all_user_ids: JSON.stringify([userId]),
        sl_project_owner_user_id: projectUserIds[0],
        sl_folder_id: folderId,
      },
      uri: buildTpdsUrl(userId, projectName, path),
      title: 'addFile',
      streamOrigin,
    }

    await enqueue(userId, 'pipeStreamFrom', job)
  }
}

async function addFile(params) {
  metrics.inc('tpds.add-file')
  const { projectId, fileId, path, projectName, rev, folderId } = params
  const streamOrigin =
    settings.apis.filestore.url +
    Path.join(`/project/${projectId}`, `/file/${fileId}`)

  await addEntity({
    projectId,
    path,
    projectName,
    rev,
    folderId,
    streamOrigin,
    entityId: fileId,
    entityType: 'file',
  })
}

function buildMovePaths(params) {
  if (params.newProjectName) {
    return {
      startPath: Path.join('/', params.projectName, '/'),
      endPath: Path.join('/', params.newProjectName, '/'),
    }
  } else {
    return {
      startPath: Path.join('/', params.projectName, '/', params.startPath),
      endPath: Path.join('/', params.projectName, '/', params.endPath),
    }
  }
}

function buildTpdsUrl(userId, projectName, filePath) {
  const projectPath = encodeURIComponent(Path.join(projectName, '/', filePath))
  return `${tpdsUrl}/user/${userId}/entity/${projectPath}`
}

async function deleteEntity(params) {
  metrics.inc('tpds.delete-entity')
  const {
    projectId,
    path,
    projectName,
    entityId,
    entityType,
    subtreeEntityIds,
  } = params

  const projectUserIds = await getProjectUsersIds(projectId)

  for (const userId of projectUserIds) {
    const job = {
      method: 'delete',
      headers: {
        sl_project_id: projectId,
        sl_all_user_ids: JSON.stringify([userId]),
        sl_project_owner_user_id: projectUserIds[0],
        sl_entity_id: entityId,
        sl_entity_type: entityType,
      },
      uri: buildTpdsUrl(userId, projectName, path),
      // We're sending a body with the DELETE request. This is unconventional,
      // but Express does handle it on the other side. Ideally, this operation
      // would be moved to a POST endpoint.
      json: { subtreeEntityIds },
      title: 'deleteEntity',
      sl_all_user_ids: JSON.stringify([userId]),
    }

    await enqueue(userId, 'standardHttpRequest', job)
  }
}

async function createProject(params) {
  if (!tpdsUrl) return // Server CE/Pro

  const { projectId, projectName, ownerId, userId } = params

  const job = {
    method: 'post',
    headers: {
      sl_project_id: projectId.toString(),
      sl_all_user_ids: JSON.stringify([userId.toString()]),
      sl_project_owner_user_id: ownerId.toString(),
    },
    uri: Path.join(
      tpdsUrl,
      'user',
      userId.toString(),
      'project',
      'new',
      encodeURIComponent(projectName)
    ),
    title: 'createProject',
    sl_all_user_ids: JSON.stringify([userId]),
  }

  await enqueue(userId, 'standardHttpRequest', job)
}

async function deleteProject(params) {
  const { projectId } = params
  // deletion only applies to project archiver
  const projectArchiverUrl = _.get(settings, [
    'apis',
    'project_archiver',
    'url',
  ])
  // silently do nothing if project archiver url is not in settings
  if (!projectArchiverUrl) {
    return
  }
  metrics.inc('tpds.delete-project')
  // send the request directly to project archiver, bypassing third-party-datastore
  try {
    const response = await fetch(
      `${settings.apis.project_archiver.url}/project/${projectId}`,
      { method: 'DELETE' }
    )
    if (!response.ok) {
      logger.error(
        { statusCode: response.status, projectId },
        'error deleting project in third party datastore (project_archiver)'
      )
      return false
    }
    return true
  } catch (err) {
    logger.error(
      { err, projectId },
      'error deleting project in third party datastore (project_archiver)'
    )
    return false
  }
}

async function enqueue(group, method, job) {
  const tpdsWorkerUrl = _.get(settings, ['apis', 'tpdsworker', 'url'])
  // silently do nothing if worker url is not in settings
  if (!tpdsWorkerUrl) {
    return
  }
  try {
    const url = new URL('/enqueue/web_to_tpds_http_requests', tpdsWorkerUrl)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group, job, method }),
      signal: AbortSignal.timeout(5 * 1000),
    })
    if (!response.ok) {
      // log error and continue
      logger.error(
        { statusCode: response.status, group, job, method },
        'error enqueueing tpdsworker job'
      )
    }
  } catch (err) {
    // log error and continue
    logger.error({ err, group, job, method }, 'error enqueueing tpdsworker job')
  }
}

async function getProjectUsersIds(projectId) {
  // get list of all user ids with access to project. project owner
  // will always be the first entry in the list.
  const userIds = await CollaboratorsGetter.getInvitedMemberIds(projectId)
  // filter invited users to only return those with dropbox linked
  const dropboxUsers = await UserGetter.getUsers(
    {
      _id: { $in: userIds.map(id => ObjectId(id)) },
      'dropbox.access_token.uid': { $ne: null },
    },
    {
      _id: 1,
    }
  )
  const dropboxUserIds = dropboxUsers.map(user => user._id)
  return dropboxUserIds
}

async function moveEntity(params) {
  metrics.inc('tpds.move-entity')
  const { projectId, rev, entityId, entityType, folderId } = params

  const projectUserIds = await getProjectUsersIds(projectId)
  const { endPath, startPath } = buildMovePaths(params)

  for (const userId of projectUserIds) {
    const headers = {
      sl_project_id: projectId,
      sl_entity_rev: rev,
      sl_all_user_ids: JSON.stringify([userId]),
      sl_project_owner_user_id: projectUserIds[0],
    }
    if (entityId != null) {
      headers.sl_entity_id = entityId
    }
    if (entityType != null) {
      headers.sl_entity_type = entityType
    }
    if (folderId != null) {
      headers.sl_folder_id = folderId
    }
    const job = {
      method: 'put',
      title: 'moveEntity',
      uri: `${tpdsUrl}/user/${userId}/entity`,
      headers,
      json: {
        user_id: userId,
        endPath,
        startPath,
      },
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
      user_ids: [userId],
    },
  }

  // Queue poll requests in the user queue along with file updates, in order
  // to avoid race conditions between polling and updates.
  await enqueue(userId, 'standardHttpRequest', job)
}

const TpdsUpdateSender = {
  addDoc: callbackify(addDoc),
  addEntity: callbackify(addEntity),
  addFile: callbackify(addFile),
  deleteEntity: callbackify(deleteEntity),
  createProject: callbackify(createProject),
  deleteProject: callbackify(deleteProject),
  enqueue: callbackify(enqueue),
  moveEntity: callbackify(moveEntity),
  pollDropboxForUser: callbackify(pollDropboxForUser),
  promises: {
    addDoc,
    addEntity,
    addFile,
    deleteEntity,
    createProject,
    deleteProject,
    enqueue,
    moveEntity,
    pollDropboxForUser,
  },
}

module.exports = TpdsUpdateSender
