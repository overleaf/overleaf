import async from 'async'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import redis from '@overleaf/redis-wrapper'
import OError from '@overleaf/o-error'
import Metrics from '@overleaf/metrics'
const rclient = redis.createClient(Settings.redis.realtime)
const Keys = Settings.redis.realtime.key_schema

const ONE_HOUR_IN_S = 60 * 60
const ONE_DAY_IN_S = ONE_HOUR_IN_S * 24
const FOUR_DAYS_IN_S = ONE_DAY_IN_S * 4

const USER_TIMEOUT_IN_S = ONE_HOUR_IN_S / 4
const REFRESH_TIMEOUT_IN_S = 10 // only show clients which have responded to a refresh request in the last 10 seconds

function recordProjectNotEmptySinceMetric(res, status) {
  const diff = Date.now() / 1000 - parseInt(res, 10)
  const BUCKETS = [
    0,
    ONE_HOUR_IN_S,
    2 * ONE_HOUR_IN_S,
    ONE_DAY_IN_S,
    2 * ONE_DAY_IN_S,
    7 * ONE_DAY_IN_S,
    30 * ONE_DAY_IN_S,
  ]
  Metrics.histogram('project_not_empty_since', diff, BUCKETS, { status })
}

export default {
  countConnectedClients(projectId, callback) {
    rclient.scard(Keys.clientsInProject({ project_id: projectId }), callback)
  },

  // Use the same method for when a user connects, and when a user sends a cursor
  // update. This way we don't care if the connected_user key has expired when
  // we receive a cursor update.
  updateUserPosition(projectId, clientId, user, cursorData, callback) {
    logger.debug({ projectId, clientId }, 'marking user as joined or connected')

    const multi = rclient.multi()

    multi.sadd(Keys.clientsInProject({ project_id: projectId }), clientId)
    multi.scard(Keys.clientsInProject({ project_id: projectId }))
    multi.expire(
      Keys.clientsInProject({ project_id: projectId }),
      FOUR_DAYS_IN_S
    )

    multi.hset(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      'last_updated_at',
      Date.now()
    )
    multi.hset(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      'user_id',
      user._id
    )
    multi.hset(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      'first_name',
      user.first_name || ''
    )
    multi.hset(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      'last_name',
      user.last_name || ''
    )
    multi.hset(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      'email',
      user.email || ''
    )

    if (cursorData) {
      multi.hset(
        Keys.connectedUser({ project_id: projectId, client_id: clientId }),
        'cursorData',
        JSON.stringify(cursorData)
      )
    }
    multi.expire(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      USER_TIMEOUT_IN_S
    )

    multi.exec(function (err, res) {
      if (err) {
        err = new OError('problem marking user as connected').withCause(err)
        return callback(err)
      }
      const [, nConnectedClients] = res
      Metrics.inc('editing_session_mode', 1, {
        method: cursorData ? 'update' : 'connect',
        status: nConnectedClients === 1 ? 'single' : 'multi',
      })
      callback(null)
    })
  },

  refreshClient(projectId, clientId) {
    logger.debug({ projectId, clientId }, 'refreshing connected client')
    const multi = rclient.multi()
    multi.hset(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      'last_updated_at',
      Date.now()
    )
    multi.expire(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      USER_TIMEOUT_IN_S
    )
    multi.exec(function (err) {
      if (err) {
        logger.err(
          { err, projectId, clientId },
          'problem refreshing connected client'
        )
      }
    })
  },

  markUserAsDisconnected(projectId, clientId, callback) {
    logger.debug({ projectId, clientId }, 'marking user as disconnected')
    const multi = rclient.multi()
    multi.srem(Keys.clientsInProject({ project_id: projectId }), clientId)
    multi.scard(Keys.clientsInProject({ project_id: projectId }))
    multi.expire(
      Keys.clientsInProject({ project_id: projectId }),
      FOUR_DAYS_IN_S
    )
    multi.del(
      Keys.connectedUser({ project_id: projectId, client_id: clientId })
    )
    multi.exec(function (err, res) {
      if (err) {
        err = new OError('problem marking user as disconnected').withCause(err)
        return callback(err)
      }
      const [, nConnectedClients] = res
      const status =
        nConnectedClients === 0
          ? 'empty'
          : nConnectedClients === 1
            ? 'single'
            : 'multi'
      Metrics.inc('editing_session_mode', 1, {
        method: 'disconnect',
        status,
      })
      if (status === 'empty') {
        rclient.getdel(Keys.projectNotEmptySince({ projectId }), (err, res) => {
          if (err) {
            logger.warn(
              { err, projectId },
              'could not collect projectNotEmptySince'
            )
          } else if (res) {
            recordProjectNotEmptySinceMetric(res, status)
          }
        })
      } else {
        // Only populate projectNotEmptySince when more clients remain connected.
        const nowInSeconds = Math.ceil(Date.now() / 1000).toString()
        // We can go back to SET GET after upgrading to redis 7.0+
        const multi = rclient.multi()
        multi.get(Keys.projectNotEmptySince({ projectId }))
        multi.set(
          Keys.projectNotEmptySince({ projectId }),
          nowInSeconds,
          'NX',
          'EX',
          31 * ONE_DAY_IN_S
        )
        multi.exec((err, res) => {
          if (err) {
            logger.warn(
              { err, projectId },
              'could not get/set projectNotEmptySince'
            )
          } else if (res[0]) {
            recordProjectNotEmptySinceMetric(res[0], status)
          }
        })
      }
      callback(null)
    })
  },

  _getConnectedUser(projectId, clientId, callback) {
    rclient.hgetall(
      Keys.connectedUser({ project_id: projectId, client_id: clientId }),
      function (err, result) {
        if (err) {
          err = new OError('problem fetching connected user details', {
            other_client_id: clientId,
          }).withCause(err)
          return callback(err)
        }
        if (!(result && result.user_id)) {
          result = {
            connected: false,
            client_id: clientId,
          }
        } else {
          result.connected = true
          result.client_id = clientId
          result.client_age =
            (Date.now() - parseInt(result.last_updated_at, 10)) / 1000
          if (result.cursorData) {
            try {
              result.cursorData = JSON.parse(result.cursorData)
            } catch (e) {
              OError.tag(e, 'error parsing cursorData JSON', {
                other_client_id: clientId,
                cursorData: result.cursorData,
              })
              return callback(e)
            }
          }
        }
        callback(err, result)
      }
    )
  },

  getConnectedUsers(projectId, callback) {
    const self = this
    rclient.smembers(
      Keys.clientsInProject({ project_id: projectId }),
      function (err, results) {
        if (err) {
          err = new OError('problem getting clients in project').withCause(err)
          return callback(err)
        }
        const jobs = results.map(
          clientId => cb => self._getConnectedUser(projectId, clientId, cb)
        )
        async.series(jobs, function (err, users) {
          if (err) {
            OError.tag(err, 'problem getting connected users')
            return callback(err)
          }
          users = users.filter(
            user =>
              user && user.connected && user.client_age < REFRESH_TIMEOUT_IN_S
          )
          callback(null, users)
        })
      }
    )
  },
}
