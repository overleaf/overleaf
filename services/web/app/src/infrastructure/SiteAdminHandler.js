const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const fs = require('fs')
const {
  addOptionalCleanupHandlerAfterDrainingConnections,
} = require('./GracefulShutdown')

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
  },
}
