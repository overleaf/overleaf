/* subscription.freeTrialExpiresAt
 * Example script for a migration:
 *
 * This script demonstrates how to write a script that is runnable either via
 * the CLI, or via a migration. The related migration is `script_example`
 * in the migrations directory.
 */

const { User } = require('../../app/src/models/User')
// const somePackage = require('some-package')

const runScript = async () => {
  const user = await User.findOne({}, { first_name: 1 }).exec()
  const name = user ? user.first_name : 'World'
  console.log(`Hello ${name}!`)
}

if (!module.parent) {
  // we are in the root module, which means that we're running as a script
  runScript()
    .then(() => process.exit())
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = runScript
