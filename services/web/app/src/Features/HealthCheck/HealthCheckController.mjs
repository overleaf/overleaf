import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import UserGetter from '../User/UserGetter.mjs'

const rclient = RedisWrapper.client('health_check')

export default {
  checkActiveHandles(req, res, next) {
    if (!(settings.maxActiveHandles > 0) || !process._getActiveHandles) {
      return next()
    }
    const activeHandlesCount = (process._getActiveHandles() || []).length
    if (activeHandlesCount > settings.maxActiveHandles) {
      logger.err(
        { activeHandlesCount, maxActiveHandles: settings.maxActiveHandles },
        'exceeded max active handles, failing health check'
      )
      return res.sendStatus(500)
    } else {
      logger.debug(
        { activeHandlesCount, maxActiveHandles: settings.maxActiveHandles },
        'active handles are below maximum'
      )
      next()
    }
  },

  checkApi(req, res, next) {
    rclient.healthCheck(err => {
      if (err) {
        logger.err({ err }, 'failed api redis health check')
        return res.sendStatus(500)
      }
      if (!settings.smokeTest.userId) {
        logger.err({}, 'smokeTest.userId is undefined in health check')
        return res.sendStatus(404)
      }
      UserGetter.getUserEmail(settings.smokeTest.userId, (err, email) => {
        if (err) {
          logger.err({ err }, 'failed api mongo health check')
          return res.sendStatus(500)
        }
        if (email == null) {
          logger.err({ err }, 'failed api mongo health check (no email)')
          return res.sendStatus(500)
        }
        res.sendStatus(200)
      })
    })
  },

  checkRedis(req, res, next) {
    return rclient.healthCheck(function (error) {
      if (error != null) {
        logger.err({ err: error }, 'failed redis health check')
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },

  checkMongo(req, res, next) {
    return UserGetter.getUserEmail(
      settings.smokeTest.userId,
      function (err, email) {
        if (err != null) {
          logger.err({ err }, 'mongo health check failed, error present')
          return res.sendStatus(500)
        } else if (email == null) {
          logger.err(
            { err },
            'mongo health check failed, no emai present in find result'
          )
          return res.sendStatus(500)
        } else {
          return res.sendStatus(200)
        }
      }
    )
  },
}
