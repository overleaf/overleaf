/* eslint-disable @overleaf/require-script-runner */
import logger from '@overleaf/logger'
import UserDeleter from '../app/src/Features/User/UserDeleter.mjs'

try {
  logger.info({}, 'starting expire deleted users script')
  await UserDeleter.promises.expireDeletedUsersAfterDuration()
  logger.info({}, 'expire deleted users script completed')
  await logger.exit(0)
} catch (err) {
  logger.error({ err }, 'expire deleted users script failed')
  await logger.exit(1)
}
