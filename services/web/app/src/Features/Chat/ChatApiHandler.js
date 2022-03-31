/* eslint-disable
    camelcase,
    node/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ChatApiHandler
const OError = require('@overleaf/o-error')
const request = require('request')
const settings = require('@overleaf/settings')
const { promisify } = require('util')

function destroyProject(project_id, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return ChatApiHandler._apiRequest(
    {
      url: `${settings.apis.chat.internal_url}/project/${project_id}`,
      method: 'DELETE',
    },
    callback
  )
}

module.exports = ChatApiHandler = {
  _apiRequest(opts, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request(opts, function (error, response, data) {
      if (error != null) {
        return callback(error)
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return callback(null, data)
      } else {
        error = new OError(
          `chat api returned non-success code: ${response.statusCode}`,
          opts
        )
        error.statusCode = response.statusCode
        return callback(error)
      }
    })
  },

  sendGlobalMessage(project_id, user_id, content, callback) {
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/messages`,
        method: 'POST',
        json: { user_id, content },
      },
      callback
    )
  },

  getGlobalMessages(project_id, limit, before, callback) {
    const qs = {}
    if (limit != null) {
      qs.limit = limit
    }
    if (before != null) {
      qs.before = before
    }

    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/messages`,
        method: 'GET',
        qs,
        json: true,
      },
      callback
    )
  },

  sendComment(project_id, thread_id, user_id, content, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/thread/${thread_id}/messages`,
        method: 'POST',
        json: { user_id, content },
      },
      callback
    )
  },

  getThreads(project_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/threads`,
        method: 'GET',
        json: true,
      },
      callback
    )
  },

  resolveThread(project_id, thread_id, user_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/thread/${thread_id}/resolve`,
        method: 'POST',
        json: { user_id },
      },
      callback
    )
  },

  reopenThread(project_id, thread_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/thread/${thread_id}/reopen`,
        method: 'POST',
      },
      callback
    )
  },

  deleteThread(project_id, thread_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/thread/${thread_id}`,
        method: 'DELETE',
      },
      callback
    )
  },

  editMessage(project_id, thread_id, message_id, userId, content, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/thread/${thread_id}/messages/${message_id}/edit`,
        method: 'POST',
        json: {
          content,
          userId,
        },
      },
      callback
    )
  },

  deleteMessage(project_id, thread_id, message_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ChatApiHandler._apiRequest(
      {
        url: `${settings.apis.chat.internal_url}/project/${project_id}/thread/${thread_id}/messages/${message_id}`,
        method: 'DELETE',
      },
      callback
    )
  },

  destroyProject,

  promises: {
    destroyProject: promisify(destroyProject),
  },
}
