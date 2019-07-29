/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HistoryManager
const request = require('request')
const settings = require('settings-sharelatex')
const async = require('async')
const UserGetter = require('../User/UserGetter')

module.exports = HistoryManager = {
  initializeProject(callback) {
    if (callback == null) {
      callback = function(error, history_id) {}
    }
    if (
      !(settings.apis.project_history != null
        ? settings.apis.project_history.initializeHistoryForNewProjects
        : undefined)
    ) {
      return callback()
    }
    return request.post(
      {
        url: `${settings.apis.project_history.url}/project`
      },
      function(error, res, body) {
        if (error != null) {
          return callback(error)
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          let project
          try {
            project = JSON.parse(body)
          } catch (error1) {
            error = error1
            return callback(error)
          }

          const overleaf_id = __guard__(
            project != null ? project.project : undefined,
            x => x.id
          )
          if (!overleaf_id) {
            error = new Error('project-history did not provide an id', project)
            return callback(error)
          }

          return callback(null, { overleaf_id })
        } else {
          error = new Error(
            `project-history returned a non-success status code: ${
              res.statusCode
            }`
          )
          return callback(error)
        }
      }
    )
  },

  flushProject(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return request.post(
      {
        url: `${settings.apis.project_history.url}/project/${project_id}/flush`
      },
      function(error, res, body) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback()
        } else {
          error = new Error(
            `project-history returned a non-success status code: ${
              res.statusCode
            }`
          )
          return callback(error)
        }
      }
    )
  },

  resyncProject(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return request.post(
      {
        url: `${settings.apis.project_history.url}/project/${project_id}/resync`
      },
      function(error, res, body) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback()
        } else {
          error = new Error(
            `project-history returned a non-success status code: ${
              res.statusCode
            }`
          )
          return callback(error)
        }
      }
    )
  },

  injectUserDetails(data, callback) {
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
    let entry, user
    if (callback == null) {
      callback = function(error, data_with_users) {}
    }
    let user_ids = new Set()
    let v1_user_ids = new Set()
    for (entry of Array.from(data.diff || data.updates || [])) {
      for (user of Array.from(
        (entry.meta != null ? entry.meta.users : undefined) || []
      )) {
        if (typeof user === 'string') {
          user_ids.add(user)
        } else if (typeof user === 'number') {
          v1_user_ids.add(user)
        }
      }
    }
    user_ids = Array.from(user_ids)
    v1_user_ids = Array.from(v1_user_ids)
    const projection = { first_name: 1, last_name: 1, email: 1 }
    return UserGetter.getUsers(user_ids, projection, function(
      error,
      users_array
    ) {
      if (error != null) {
        return callback(error)
      }
      const v1_query = { 'overleaf.id': v1_user_ids }
      const users = {}
      for (user of Array.from(users_array || [])) {
        users[user._id.toString()] = HistoryManager._userView(user)
      }
      projection.overleaf = 1
      UserGetter.getUsersByV1Ids(
        v1_user_ids,
        projection,
        (error, v1_identified_users_array) => {
          for (user of Array.from(v1_identified_users_array || [])) {
            users[user.overleaf.id] = HistoryManager._userView(user)
          }
          for (entry of Array.from(data.diff || data.updates || [])) {
            if (entry.meta != null) {
              entry.meta.users = (
                (entry.meta != null ? entry.meta.users : undefined) || []
              ).map(function(user) {
                if (typeof user === 'string' || typeof user === 'number') {
                  return users[user]
                } else {
                  return user
                }
              })
            }
          }
          return callback(null, data)
        }
      )
    })
  },

  _userView(user) {
    const { _id, first_name, last_name, email } = user
    return { first_name, last_name, email, id: _id }
  }
}
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
