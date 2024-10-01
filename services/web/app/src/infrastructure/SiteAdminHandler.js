const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const fs = require('fs')
const {
  addOptionalCleanupHandlerAfterDrainingConnections,
  addRequiredCleanupHandlerBeforeDrainingConnections,
} = require('./GracefulShutdown')
const Features = require('./Features')
const UserHandler = require('../Features/User/UserHandler')
const metrics = require('@overleaf/metrics')

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

module.exports = {
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
