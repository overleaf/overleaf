import { promisify } from 'node:util'
import InstitutionsManager from '../app/src/Features/Institutions/InstitutionsManager.js'
import { fileURLToPath } from 'node:url'
const sleep = promisify(setTimeout)

async function main() {
  const institutionId = parseInt(process.argv[2])
  if (isNaN(institutionId)) throw new Error('No institution id')
  const dryRun = process.argv.includes('--dry-run')

  console.log('Deleting notifications of institution', institutionId)

  const preview =
    await InstitutionsManager.promises.clearInstitutionNotifications(
      institutionId,
      true
    )
  console.log('--- Preview ---')
  console.log(JSON.stringify(preview, null, 4))
  console.log('---------------')

  if (dryRun) {
    console.log('Exiting early due to --dry-run flag')
    return
  }

  console.log('Exit in the next 10s in case these numbers are off.')
  await sleep(10 * 1000)

  const cleared =
    await InstitutionsManager.promises.clearInstitutionNotifications(
      institutionId,
      false
    )
  console.log('--- Cleared ---')
  console.log(JSON.stringify(cleared, null, 4))
  console.log('---------------')
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main()
    console.log('Done.')
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
