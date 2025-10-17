import { processNotifications } from '../modules/notifications/app/src/ProcessNotifications.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

async function main() {
  console.log('Processing notifications...')
  await processNotifications()
  console.log('Notifications processed successfully.')
}

try {
  await scriptRunner(main)
  console.log('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}
