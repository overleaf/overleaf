const UpdatesManager = require('../app/js/UpdatesManager')
const { waitForDb } = require('../app/js/mongodb')

async function main() {
  await waitForDb()
  return new Promise((resolve, reject) => {
    const limit = -1
    console.log('Flushing all updates')
    UpdatesManager.flushAll(limit, err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

main()
  .then(() => {
    console.log('Done flushing all updates')
    process.exit(0)
  })
  .catch(error => {
    console.error('There was an error flushing updates', { error })
    process.exit(1)
  })
