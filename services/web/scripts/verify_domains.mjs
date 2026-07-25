import { scriptRunner } from './lib/ScriptRunner.mjs'
import DomainVerificationCron from '../modules/group-settings/app/src/DomainVerificationCron.mjs'

async function main() {
  await DomainVerificationCron.promises.verifyAll()
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
