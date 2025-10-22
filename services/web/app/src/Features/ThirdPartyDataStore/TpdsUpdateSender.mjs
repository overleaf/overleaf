import mongodb from 'mongodb-legacy'
import _ from 'lodash'
import { callbackify } from 'node:util'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import Path from 'node:path'
import { fetchNothing } from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'
import CollaboratorsGetterModule from '../Collaborators/CollaboratorsGetter.mjs'
import UserGetterModule from '../User/UserGetter.mjs'

const { promises: UserGetter } = UserGetterModule
const { promises: CollaboratorsGetter } = CollaboratorsGetterModule

const { ObjectId } = mongodb

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
    streamFallback,
    entityId,
    entityType,
  } = params

  const projectUserIds = await getProjectUsersIds(projectId)

  for (const userId of projectUserIds) {
    const job = {
      method: 'post',
      headers: {
        'x-entity-id': entityId,
        'x-entity-rev': rev,
        'x-entity-type': entityType,
        'x-folder-id': folderId,
        'x-project-id': projectId,
      },
      uri: buildTpdsUrl(userId, projectName, path),
      title: 'addFile',
      streamOrigin,
      streamFallback,
    }

    await enqueue(userId, 'pipeStreamFrom', job)
  }
}

async function addFile(params) {
  metrics.inc('tpds.add-file')
  const {
    projectId,
    historyId,
    fileId,
    hash,
    path,
    projectName,
    rev,
    folderId,
  } = params
  await addEntity({
    projectId,
    path,
    projectName,
    rev,
    folderId,
    // Go through project-history to avoid the need for handling history-v1 authentication.
    streamOrigin: `${settings.apis.project_history.url}/project/${historyId}/blob/${hash}`,
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
        'x-entity-id': entityId,
        'x-entity-type': entityType,
        'x-project-id': projectId,
      },
      uri: buildTpdsUrl(userId, projectName, path),
      // We're sending a body with the DELETE request. This is unconventional,
      // but Express does handle it on the other side. Ideally, this operation
      // would be moved to a POST endpoint.
      json: { subtreeEntityIds },
      title: 'deleteEntity',
    }

    await enqueue(userId, 'standardHttpRequest', job)
  }
}

async function createProject(params) {
  if (!tpdsUrl) return // Overleaf Community Edition/Server Pro

  const { projectId, projectName, userId } = params

  const job = {
    method: 'post',
    headers: {
      'x-project-id': projectId,
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
  }

  await enqueue(userId, 'standardHttpRequest', job)
}

async function enqueue(group, method, job) {
  const tpdsWorkerUrl = _.get(settings, ['apis', 'tpdsworker', 'url'])
  // silently do nothing if worker url is not in settings
  if (!tpdsWorkerUrl) {
    return
  }
  try {
    const url = new URL('/enqueue/web_to_tpds_http_requests', tpdsWorkerUrl)
    await fetchNothing(url, {
      method: 'POST',
      json: { group, job, method },
      signal: AbortSignal.timeout(5 * 1000),
    })
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
      _id: { $in: userIds.map(id => new ObjectId(id)) },
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
      'x-project-id': projectId,
      'x-entity-rev': rev,
    }
    if (entityId != null) {
      headers['x-entity-id'] = entityId
    }
    if (entityType != null) {
      headers['x-entity-type'] = entityType
    }
    if (folderId != null) {
      headers['x-folder-id'] = folderId
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
  enqueue: callbackify(enqueue),
  moveEntity: callbackify(moveEntity),
  pollDropboxForUser: callbackify(pollDropboxForUser),
  promises: {
    addDoc,
    addEntity,
    addFile,
    deleteEntity,
    createProject,
    enqueue,
    moveEntity,
    pollDropboxForUser,
  },
}

export default TpdsUpdateSender
