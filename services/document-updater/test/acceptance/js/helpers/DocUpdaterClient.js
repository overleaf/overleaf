/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocUpdaterClient
const Settings = require('settings-sharelatex')
const rclient = require('redis-sharelatex').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema
const request = require('request').defaults({ jar: false })
const async = require('async')

const rclient_sub = require('redis-sharelatex').createClient(
  Settings.redis.pubsub
)
rclient_sub.subscribe('applied-ops')
rclient_sub.setMaxListeners(0)

module.exports = DocUpdaterClient = {
  randomId() {
    const chars = __range__(1, 24, true).map(
      (i) => Math.random().toString(16)[2]
    )
    return chars.join('')
  },

  subscribeToAppliedOps(callback) {
    rclient_sub.on('message', callback)
  },

  sendUpdate(project_id, doc_id, update, callback) {
    rclient.rpush(
      keys.pendingUpdates({ doc_id }),
      JSON.stringify(update),
      (error) => {
        if (error) {
          return callback(error)
        }
        const doc_key = `${project_id}:${doc_id}`
        rclient.sadd('DocsWithPendingUpdates', doc_key, (error) => {
          if (error) {
            return callback(error)
          }
          rclient.rpush('pending-updates-list', doc_key, callback)
        })
      }
    )
  },

  sendUpdates(project_id, doc_id, updates, callback) {
    DocUpdaterClient.preloadDoc(project_id, doc_id, (error) => {
      if (error) {
        return callback(error)
      }
      const jobs = []
      for (const update of Array.from(updates)) {
        ;((update) =>
          jobs.push((callback) =>
            DocUpdaterClient.sendUpdate(project_id, doc_id, update, callback)
          ))(update)
      }
      async.series(jobs, (err) =>
        DocUpdaterClient.waitForPendingUpdates(project_id, doc_id, callback)
      )
    })
  },

  waitForPendingUpdates(project_id, doc_id, callback) {
    async.retry(
      { times: 30, interval: 100 },
      (cb) =>
        rclient.llen(keys.pendingUpdates({ doc_id }), (err, length) => {
          if (length > 0) {
            cb(new Error('updates still pending'))
          } else {
            cb()
          }
        }),
      callback
    )
  },

  getDoc(project_id, doc_id, callback) {
    request.get(
      `http://localhost:3003/project/${project_id}/doc/${doc_id}`,
      (error, res, body) => {
        if (body != null && res.statusCode >= 200 && res.statusCode < 300) {
          body = JSON.parse(body)
        }
        callback(error, res, body)
      }
    )
  },

  getDocAndRecentOps(project_id, doc_id, fromVersion, callback) {
    request.get(
      `http://localhost:3003/project/${project_id}/doc/${doc_id}?fromVersion=${fromVersion}`,
      (error, res, body) => {
        if (body != null && res.statusCode >= 200 && res.statusCode < 300) {
          body = JSON.parse(body)
        }
        callback(error, res, body)
      }
    )
  },

  preloadDoc(project_id, doc_id, callback) {
    DocUpdaterClient.getDoc(project_id, doc_id, callback)
  },

  flushDoc(project_id, doc_id, callback) {
    request.post(
      `http://localhost:3003/project/${project_id}/doc/${doc_id}/flush`,
      (error, res, body) => callback(error, res, body)
    )
  },

  setDocLines(project_id, doc_id, lines, source, user_id, undoing, callback) {
    request.post(
      {
        url: `http://localhost:3003/project/${project_id}/doc/${doc_id}`,
        json: {
          lines,
          source,
          user_id,
          undoing
        }
      },
      (error, res, body) => callback(error, res, body)
    )
  },

  deleteDoc(project_id, doc_id, callback) {
    request.del(
      `http://localhost:3003/project/${project_id}/doc/${doc_id}`,
      (error, res, body) => callback(error, res, body)
    )
  },

  flushProject(project_id, callback) {
    request.post(`http://localhost:3003/project/${project_id}/flush`, callback)
  },

  deleteProject(project_id, callback) {
    request.del(`http://localhost:3003/project/${project_id}`, callback)
  },

  deleteProjectOnShutdown(project_id, callback) {
    request.del(
      `http://localhost:3003/project/${project_id}?background=true&shutdown=true`,
      callback
    )
  },

  flushOldProjects(callback) {
    request.get(
      'http://localhost:3003/flush_queued_projects?min_delete_age=1',
      callback
    )
  },

  acceptChange(project_id, doc_id, change_id, callback) {
    request.post(
      `http://localhost:3003/project/${project_id}/doc/${doc_id}/change/${change_id}/accept`,
      callback
    )
  },

  removeComment(project_id, doc_id, comment, callback) {
    request.del(
      `http://localhost:3003/project/${project_id}/doc/${doc_id}/comment/${comment}`,
      callback
    )
  },

  getProjectDocs(project_id, projectStateHash, callback) {
    request.get(
      `http://localhost:3003/project/${project_id}/doc?state=${projectStateHash}`,
      (error, res, body) => {
        if (body != null && res.statusCode >= 200 && res.statusCode < 300) {
          body = JSON.parse(body)
        }
        callback(error, res, body)
      }
    )
  },

  sendProjectUpdate(
    project_id,
    userId,
    docUpdates,
    fileUpdates,
    version,
    callback
  ) {
    request.post(
      {
        url: `http://localhost:3003/project/${project_id}`,
        json: { userId, docUpdates, fileUpdates, version }
      },
      (error, res, body) => callback(error, res, body)
    )
  }
}

function __range__(left, right, inclusive) {
  const range = []
  const ascending = left < right
  const end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}
