const { callbackify } = require('util')
const request = require('request-promise-native')
const settings = require('settings-sharelatex')
const OError = require('@overleaf/o-error')
const UserGetter = require('../User/UserGetter')

module.exports = {
  initializeProject: callbackify(initializeProject),
  flushProject: callbackify(flushProject),
  resyncProject: callbackify(resyncProject),
  deleteProject: callbackify(deleteProject),
  injectUserDetails: callbackify(injectUserDetails),
  promises: {
    initializeProject,
    flushProject,
    resyncProject,
    deleteProject,
    injectUserDetails
  }
}

async function initializeProject() {
  if (
    !(
      settings.apis.project_history &&
      settings.apis.project_history.initializeHistoryForNewProjects
    )
  ) {
    return
  }
  try {
    const body = await request.post({
      url: `${settings.apis.project_history.url}/project`
    })
    const project = JSON.parse(body)
    const overleafId = project && project.project && project.project.id
    if (!overleafId) {
      throw new Error('project-history did not provide an id', project)
    }
    return { overleaf_id: overleafId }
  } catch (err) {
    throw OError.tag(err, 'failed to initialize project history')
  }
}

async function flushProject(projectId) {
  try {
    await request.post({
      url: `${settings.apis.project_history.url}/project/${projectId}/flush`
    })
  } catch (err) {
    throw OError.tag(err, 'failed to flush project to project history', {
      projectId
    })
  }
}

async function resyncProject(projectId) {
  try {
    await request.post({
      url: `${settings.apis.project_history.url}/project/${projectId}/resync`
    })
  } catch (err) {
    throw new OError('failed to resync project history', { projectId })
  }
}

async function deleteProject(projectId) {
  try {
    await request.delete(
      `${settings.apis.project_history.url}/project/${projectId}`
    )
  } catch (err) {
    throw new OError('failed to clear project history', { projectId })
  }
}

async function injectUserDetails(data) {
  // data can be either:
  // {
  // 	diff: [{
  // 		i: "foo",
  // 		meta: {
  // 			users: ["user_id", v1_user_id, ...]
  // 			...
  // 		}
  // 	}, ...]
  // }
  // or
  // {
  // 	updates: [{
  // 		pathnames: ["main.tex"]
  // 		meta: {
  // 			users: ["user_id", v1_user_id, ...]
  // 			...
  // 		},
  // 		...
  // 	}, ...]
  // }
  // Either way, the top level key points to an array of objects with a meta.users property
  // that we need to replace user_ids with populated user objects.
  // Note that some entries in the users arrays may be v1 ids returned by the v1 history
  // service. v1 ids will be `numbers`
  let userIds = new Set()
  let v1UserIds = new Set()
  const entries = Array.isArray(data.diff)
    ? data.diff
    : Array.isArray(data.updates)
    ? data.updates
    : []
  for (const entry of entries) {
    for (const user of (entry.meta && entry.meta.users) || []) {
      if (typeof user === 'string') {
        userIds.add(user)
      } else if (typeof user === 'number') {
        v1UserIds.add(user)
      }
    }
  }

  userIds = Array.from(userIds)
  v1UserIds = Array.from(v1UserIds)
  const projection = { first_name: 1, last_name: 1, email: 1 }
  const usersArray = await UserGetter.promises.getUsers(userIds, projection)
  const users = {}
  for (const user of usersArray) {
    users[user._id.toString()] = _userView(user)
  }
  projection.overleaf = 1
  const v1IdentifiedUsersArray = await UserGetter.promises.getUsersByV1Ids(
    v1UserIds,
    projection
  )
  for (const user of v1IdentifiedUsersArray) {
    users[user.overleaf.id] = _userView(user)
  }
  for (const entry of entries) {
    if (entry.meta != null) {
      entry.meta.users = ((entry.meta && entry.meta.users) || []).map(user => {
        if (typeof user === 'string' || typeof user === 'number') {
          return users[user]
        } else {
          return user
        }
      })
    }
  }
  return data
}

function _userView(user) {
  const { _id, first_name: firstName, last_name: lastName, email } = user
  return { first_name: firstName, last_name: lastName, email, id: _id }
}
