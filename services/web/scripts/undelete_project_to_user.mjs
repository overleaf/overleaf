import minimist from 'minimist'
import ProjectDeleter from '../app/src/Features/Project/ProjectDeleter.js'

async function main() {
  const argv = minimist(process.argv.slice(2))
  const projectId = argv['project-id']
  const userId = argv['user-id']

  if (!projectId || !userId) {
    throw new Error('set --project-id and --user-id')
  }
  console.log(`Restoring project ${projectId} to user ${userId}`)
  await ProjectDeleter.promises.undeleteProject(projectId, { userId })
}

try {
  await main()
  console.log('Done.')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
