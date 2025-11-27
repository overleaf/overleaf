import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import fs from 'node:fs'

import {
  addOptionalCleanupHandlerAfterDrainingConnections,
  addRequiredCleanupHandlerBeforeDrainingConnections,
} from './GracefulShutdown.mjs'

import Features from './Features.mjs'
import UserHandler from '../Features/User/UserHandler.mjs'
import metrics from '@overleaf/metrics'

// Monitor a site maintenance file (e.g. /etc/site_status) periodically and
// close the site if the file contents contain the string "closed".

const STATUS_FILE_CHECK_INTERVAL = 5000
const statusFile = settings.siteMaintenanceFile

function updateSiteMaintenanceStatus(fileContent) {
  const isClosed = !settings.siteIsOpen
  const shouldBeClosed = fileContent && fileContent.indexOf('closed') >= 0
  if (!isClosed && shouldBeClosed) {
    settings.siteIsOpen = false
    logger.warn({ fileContent }, 'putting site into maintenance mode')
  } else if (isClosed && !shouldBeClosed) {
    settings.siteIsOpen = true
    logger.warn({ fileContent }, 'taking site out of maintenance mode')
  }
}

function pollSiteMaintenanceFile() {
  fs.readFile(statusFile, { encoding: 'utf8' }, (err, fileContent) => {
    if (err) {
      logger.error(
        { file: statusFile, fsErr: err },
        'error reading site maintenance file'
      )
      return
    }
    updateSiteMaintenanceStatus(fileContent)
  })
}

function checkSiteMaintenanceFileSync() {
  // crash on start up if file does not exist
  const content = fs.readFileSync(statusFile, { encoding: 'utf8' })
  updateSiteMaintenanceStatus(content)
}

const SERVER_PRO_ACTIVE_USERS_METRIC_INTERVAL =
  settings.activeUserMetricInterval || 1000 * 60 * 60

function publishActiveUsersMetric() {
  UserHandler.promises
    .countActiveUsers()
    .then(activeUserCount => metrics.gauge('num_active_users', activeUserCount))
    .catch(error => logger.error({ error }, 'error counting active users'))
}

export default {
  initialise() {
    if (settings.enabledServices.includes('web') && statusFile) {
      logger.debug(
        { statusFile, interval: STATUS_FILE_CHECK_INTERVAL },
        'monitoring site maintenance file'
      )
      checkSiteMaintenanceFileSync() // perform an initial synchronous check at start up
      const intervalHandle = setInterval(
        pollSiteMaintenanceFile,
        STATUS_FILE_CHECK_INTERVAL
      ) // continue checking periodically
      addOptionalCleanupHandlerAfterDrainingConnections(
        'poll site maintenance file',
        () => {
          clearInterval(intervalHandle)
        }
      )
    }
    if (!Features.hasFeature('saas')) {
      publishActiveUsersMetric()
      const intervalHandle = setInterval(
        publishActiveUsersMetric,
        SERVER_PRO_ACTIVE_USERS_METRIC_INTERVAL
      )
      addRequiredCleanupHandlerBeforeDrainingConnections(
        'publish server pro usage metrics',
        () => {
          clearInterval(intervalHandle)
        }
      )
    }
  },
}
