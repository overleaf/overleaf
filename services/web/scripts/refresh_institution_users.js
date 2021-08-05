const { waitForDb } = require('../app/src/infrastructure/mongodb')
const minimist = require('minimist')
const InstitutionsManager = require('../app/src/Features/Institutions/InstitutionsManager')

const institutionId = parseInt(process.argv[2])
if (isNaN(institutionId)) throw new Error('No institution id')
console.log('Upgrading users of institution', institutionId)

waitForDb()
  .then(main)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

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
