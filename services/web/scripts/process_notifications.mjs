/* eslint-disable @overleaf/require-script-runner */
import logger from '@overleaf/logger'
import { processNotifications } from '../modules/notifications/app/src/ProcessNotifications.mjs'

async function main() {
  logger.info({}, 'Processing notifications...')
  const startTime = performance.now()
  const {
    notificationsFound,
    notificationsReady,
    emailsSent,
    pendingCountsByType,
  } = await processNotifications()
  const durationMs = Math.round(performance.now() - startTime)
  logger.info(
    {
      notificationsFound,
      notificationsReady,
      emailsSent,
      pendingCountsByType,
      durationMs,
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
