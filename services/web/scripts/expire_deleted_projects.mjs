/* eslint-disable @overleaf/require-script-runner */
import logger from '@overleaf/logger'
import ProjectDeleter from '../app/src/Features/Project/ProjectDeleter.mjs'

try {
  logger.info({}, 'starting expire deleted projects script')
  await ProjectDeleter.promises.expireDeletedProjectsAfterDuration()
  logger.info({}, 'expire deleted projects script completed')
  await logger.exit(0)
} catch (err) {
  logger.error({ err }, 'expire deleted projects script failed')
  await logger.exit(1)
}
