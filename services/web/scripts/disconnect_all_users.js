const AdminController = require('../app/src/Features/ServerAdmin/AdminController')

if (require.main === module) {
  if (['--help', 'help'].includes(process.argv[2])) {
    console.log('\n  usage: node disconnect_all_users.js [delay-in-seconds]\n')
    process.exit(1)
  }
  const delaySecondsString = process.argv[2]
  const delay = parseInt(delaySecondsString, 10) || 10
  console.log(`Disconnect all users, with delay ${delay}`)
  AdminController._sendDisconnectAllUsersMessage(delay)
    .then(() => {
      console.error('Done.')
      process.exit(0)
    })
    .catch(err => {
      console.error('Error', err)
      process.exit(1)
    })
}
