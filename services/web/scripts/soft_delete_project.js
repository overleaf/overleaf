const minimist = require('minimist')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const ProjectDeleter = require('../app/src/Features/Project/ProjectDeleter')

async function main() {
  const argv = minimist(process.argv.slice(2))
  const projectId = argv['project-id']

  if (!projectId) {
    throw new Error('set --project-id')
  }
  console.log(`Soft deleting project ${projectId}`)
  await waitForDb()

  // soft delete, project will be permanently deleted after 90 days
  await ProjectDeleter.promises.deleteProject(projectId)
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
