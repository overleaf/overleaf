import minimist from 'minimist'
import InstitutionsManager from '../app/src/Features/Institutions/InstitutionsManager.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
console.log('Refreshing users at institution', institutionId)

function main() {
  const argv = minimist(process.argv.slice(2))
  if (!argv.notify) {
    throw new Error('Missing `notify` flag. Please use `--notify true|false`')
  }
  if (!argv.notify[0]) {
    throw new Error('Empty `notify` flag. Please use `--notify true|false`')
  }
  const notify = argv.notify[0] === 't'
  console.log('Running with notify =', notify)

  InstitutionsManager.refreshInstitutionUsers(
    institutionId,
    notify,
    function (error) {
      if (error) {
        console.log(error)
      } else {
        console.log('DONE 👌')
      }
      process.exit()
    }
  )
}

try {
  await scriptRunner(main)
} catch (error) {
  console.error(error)
  process.exit(1)
}
