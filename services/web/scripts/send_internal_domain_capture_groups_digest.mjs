import { scriptRunner } from './lib/ScriptRunner.mjs'
import InternalDomainCaptureDigest from '../modules/group-settings/app/src/crons/InternalDomainCaptureDigest.mjs'

async function main() {
  await InternalDomainCaptureDigest.promises.sendInternalDomainCaptureGroupsDigest()
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
