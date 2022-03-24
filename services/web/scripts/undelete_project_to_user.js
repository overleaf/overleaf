const minimist = require('minimist')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const ProjectDeleter = require('../app/src/Features/Project/ProjectDeleter')

async function main() {
  const argv = minimist(process.argv.slice(2))
  const projectId = argv['project-id']
  const userId = argv['user-id']

  if (!projectId || !userId) {
    throw new Error('set --project-id and --user-id')
  }
  console.log(`Restoring project ${projectId} to user ${userId}`)
  await waitForDb()
  await ProjectDeleter.promises.undeleteProject(projectId, { userId })
}

main()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
