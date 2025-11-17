/* subscription.freeTrialExpiresAt
 * Example script for a migration:
 *
 * This script demonstrates how to write a script that is runnable either via
 * the CLI, or via a migration. The related migration is `script_example`
 * in the migrations directory.
 */

import { User } from '../../app/src/models/User.mjs'
import { fileURLToPath } from 'node:url'

// const somePackage = require('some-package')

const runScript = async () => {
  const user = await User.findOne({}, { first_name: 1 }).exec()
  const name = user ? user.first_name : 'World'
  console.log(`Hello ${name}!`)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runScript()
    process.exit()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

export default runScript
