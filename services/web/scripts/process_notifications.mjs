/* eslint-disable @overleaf/require-script-runner */
import logger from '@overleaf/logger'
import { processNotifications } from '../modules/notifications/app/src/ProcessNotifications.mjs'

async function main() {
  logger.info({}, 'Processing notifications...')
  const {
    notificationsFound,
    notificationsReady,
    emailsSent,
    dryRunProcessed,
    dryRunWouldHaveSent,
  } = await processNotifications()
  logger.info(
    {
      notificationsFound,
      notificationsReady,
      emailsSent,
      dryRunProcessed,
      dryRunWouldHaveSent,
    },
    'Notifications processed successfully.'
  )
}

try {
  await main()
  process.exit(0)
} catch (error) {
  logger.error({ error }, 'error processing notifications')
  process.exit(1)
}
