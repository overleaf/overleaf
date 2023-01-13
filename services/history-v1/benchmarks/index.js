const testSetup = require('../test/setup')
const blobStoreSuite = require('./blob_store')

async function main() {
  await testSetup.setupPostgresDatabase()
  await testSetup.createGcsBuckets()
  await blobStoreSuite()
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
