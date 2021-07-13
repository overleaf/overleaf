let DocUpdaterClient
const Settings = require('@overleaf/settings')
const _ = require('lodash')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const keys = Settings.redis.documentupdater.key_schema
const request = require('request').defaults({ jar: false })
const async = require('async')

const rclientSub = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.pubsub
)
rclientSub.subscribe('applied-ops')
rclientSub.setMaxListeners(0)

module.exports = DocUpdaterClient = {
  randomId() {
    let str = ''
    for (let i = 0; i < 24; i++) {
      str += Math.floor(Math.random() * 16).toString(16)
    }
    return str
  },

  subscribeToAppliedOps(callback) {
    rclientSub.on('message', callback)
  },

  _getPendingUpdateListKey() {
    const shard = _.random(0, Settings.dispatcherCount - 1)
    if (shard === 0) {
      return 'pending-updates-list'
    } else {
      return `pending-updates-list-${shard}`
    }
  },

  sendUpdate(projectId, docId, update, callback) {
    rclient.rpush(
      keys.pendingUpdates({ doc_id: docId }),
      JSON.stringify(update),
      error => {
        if (error) {
          return callback(error)
        }
        const docKey = `${projectId}:${docId}`
        rclient.sadd('DocsWithPendingUpdates', docKey, error => {
          if (error) {
            return callback(error)
          }

          rclient.rpush(
            DocUpdaterClient._getPendingUpdateListKey(),
            docKey,
            callback
          )
        })
      }
    )
  },

  sendUpdates(projectId, docId, updates, callback) {
    DocUpdaterClient.preloadDoc(projectId, docId, error => {
      if (error) {
        return callback(error)
      }
      const jobs = updates.map(update => callback => {
        DocUpdaterClient.sendUpdate(projectId, docId, update, callback)
      })
      async.series(jobs, err => {
        if (err) {
          return callback(err)
        }
        DocUpdaterClient.waitForPendingUpdates(projectId, docId, callback)
      })
    })
  },

  waitForPendingUpdates(projectId, docId, callback) {
    async.retry(
      { times: 30, interval: 100 },
      cb =>
        rclient.llen(keys.pendingUpdates({ doc_id: docId }), (err, length) => {
          if (err) {
            return cb(err)
          }
          if (length > 0) {
            cb(new Error('updates still pending'))
          } else {
            cb()
          }
        }),
      callback
    )
  },

  getDoc(projectId, docId, callback) {
    request.get(
      `http://localhost:3003/project/${projectId}/doc/${docId}`,
      (error, res, body) => {
        if (body != null && res.statusCode >= 200 && res.statusCode < 300) {
          body = JSON.parse(body)
        }
        callback(error, res, body)
      }
    )
  },

  getDocAndRecentOps(projectId, docId, fromVersion, callback) {
    request.get(
      `http://localhost:3003/project/${projectId}/doc/${docId}?fromVersion=${fromVersion}`,
      (error, res, body) => {
        if (body != null && res.statusCode >= 200 && res.statusCode < 300) {
          body = JSON.parse(body)
        }
        callback(error, res, body)
      }
    )
  },

  preloadDoc(projectId, docId, callback) {
    DocUpdaterClient.getDoc(projectId, docId, callback)
  },

  flushDoc(projectId, docId, callback) {
    request.post(
      `http://localhost:3003/project/${projectId}/doc/${docId}/flush`,
      (error, res, body) => callback(error, res, body)
    )
  },

  setDocLines(projectId, docId, lines, source, userId, undoing, callback) {
    request.post(
      {
        url: `http://localhost:3003/project/${projectId}/doc/${docId}`,
        json: {
          lines,
          source,
          user_id: userId,
          undoing,
        },
      },
      (error, res, body) => callback(error, res, body)
    )
  },

  deleteDoc(projectId, docId, callback) {
    request.del(
      `http://localhost:3003/project/${projectId}/doc/${docId}`,
      (error, res, body) => callback(error, res, body)
    )
  },

  flushProject(projectId, callback) {
    request.post(`http://localhost:3003/project/${projectId}/flush`, callback)
  },

  deleteProject(projectId, callback) {
    request.del(`http://localhost:3003/project/${projectId}`, callback)
  },

  deleteProjectOnShutdown(projectId, callback) {
    request.del(
      `http://localhost:3003/project/${projectId}?background=true&shutdown=true`,
      callback
    )
  },

  flushOldProjects(callback) {
    request.get(
      'http://localhost:3003/flush_queued_projects?min_delete_age=1',
      callback
    )
  },

  acceptChange(projectId, docId, changeId, callback) {
    request.post(
      `http://localhost:3003/project/${projectId}/doc/${docId}/change/${changeId}/accept`,
      callback
    )
  },

  removeComment(projectId, docId, comment, callback) {
    request.del(
      `http://localhost:3003/project/${projectId}/doc/${docId}/comment/${comment}`,
      callback
    )
  },

  getProjectDocs(projectId, projectStateHash, callback) {
    request.get(
      `http://localhost:3003/project/${projectId}/doc?state=${projectStateHash}`,
      (error, res, body) => {
        if (body != null && res.statusCode >= 200 && res.statusCode < 300) {
          body = JSON.parse(body)
        }
        callback(error, res, body)
      }
    )
  },

  sendProjectUpdate(projectId, userId, updates, version, callback) {
    request.post(
      {
        url: `http://localhost:3003/project/${projectId}`,
        json: { userId, updates, version },
      },
      (error, res, body) => callback(error, res, body)
    )
  },
}
