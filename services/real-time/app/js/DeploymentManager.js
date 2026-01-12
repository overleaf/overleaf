import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import fs from 'node:fs'

// Monitor a status file (e.g. /etc/real_time_status) periodically and close the
// service if the file contents don't contain the matching deployment colour.

const FILE_CHECK_INTERVAL = 5000
const statusFile = settings.deploymentFile
const deploymentColour = settings.deploymentColour

let serviceCloseTime

function updateDeploymentStatus(fileContent) {
  const closed = fileContent && !fileContent.includes(deploymentColour)
  if (closed && !settings.serviceIsClosed) {
    settings.serviceIsClosed = true
    serviceCloseTime = Date.now() + 60 * 1000 // delay closing by 1 minute
    logger.info({ fileContent }, 'closing service')
  } else if (!closed && settings.serviceIsClosed) {
    settings.serviceIsClosed = false
    logger.info({ fileContent }, 'opening service')
  }
}

function pollStatusFile() {
  fs.readFile(statusFile, { encoding: 'utf8' }, (err, fileContent) => {
    if (err) {
      logger.error(
        { file: statusFile, fsErr: err },
        'error reading service status file'
      )
      return
    }
    updateDeploymentStatus(fileContent)
  })
}

function checkStatusFileSync() {
  // crash on start up if file does not exist
  const content = fs.readFileSync(statusFile, { encoding: 'utf8' })
  updateDeploymentStatus(content)
  if (settings.serviceIsClosed) {
    serviceCloseTime = Date.now() // skip closing delay on start up
  }
}

export default {
  initialise() {
    if (statusFile && deploymentColour) {
      logger.info(
        { statusFile, deploymentColour, interval: FILE_CHECK_INTERVAL },
        'monitoring deployment status file'
      )
      checkStatusFileSync() // perform an initial synchronous check at start up
      setInterval(pollStatusFile, FILE_CHECK_INTERVAL) // continue checking periodically
    }
  },
  deploymentIsClosed() {
    return settings.serviceIsClosed && Date.now() >= serviceCloseTime
  },
}
