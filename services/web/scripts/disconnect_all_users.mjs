import { promisify } from 'node:util'
import Settings from '@overleaf/settings'
import AdminController from '../app/src/Features/ServerAdmin/AdminController.js'
import minimist from 'minimist'
import { fileURLToPath } from 'node:url'

const args = minimist(process.argv.slice(2), {
  string: ['confirm-site-url', 'delay-in-seconds'],
  default: {
    'delay-in-seconds': 10,
    'confirm-site-url': '',
  },
})

const sleep = promisify(setTimeout)

async function main() {
  if (args.help) {
    console.error()
    console.error(
      '  usage: node disconnect_all_users.mjs [--delay-in-seconds=10] --confirm-site-url=https://www....\n'
    )
    process.exit(1)
  }
  const isSaaS = Boolean(Settings.overleaf)
  if (isSaaS && args['confirm-site-url'] !== Settings.siteUrl) {
    console.error()
    console.error(
      'Please confirm the environment you want to disconnect ALL USERS from by specifying the site URL aka PUBLIC_URL, e.g. --confirm-site-url=https://www.dev-overleaf.com for the dev-env'
    )
    console.error()
    console.error(
      `!!!  --confirm-site-url=${
        args['confirm-site-url'] || "''"
      } does not match the PUBLIC_URL in this environment.`
    )
    console.error()
    console.error('  Are you running this script in the correct environment?')
    process.exit(1)
  }
  const delay = parseInt(args['delay-in-seconds'] || '10', 10)
  if (!(delay >= 0)) {
    console.error(
      `--delay-in-seconds='${args['delay-in-seconds']}' should be a number >=0`
    )
    process.exit(1)
  }
  console.log()
  console.log(
    `Disconnect all users from ${args['confirm-site-url']}, with delay ${delay}`
  )

  if (isSaaS) {
    console.error('  Use CTRL+C in the next 5s to abort.')
    await sleep(5 * 1000)
  }

  await AdminController._sendDisconnectAllUsersMessage(delay)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main()
    console.error('Done.')
    process.exit(0)
  } catch (error) {
    console.error('Error', error)
    process.exit(1)
  }
}
