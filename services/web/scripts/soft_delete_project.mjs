import minimist from 'minimist'
import ProjectDeleter from '../app/src/Features/Project/ProjectDeleter.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

async function main() {
  const argv = minimist(process.argv.slice(2))
  const projectId = argv['project-id']

  if (!projectId) {
    throw new Error('set --project-id')
  }
  console.log(`Soft deleting project ${projectId}`)
  // soft delete, project will be permanently deleted after 90 days
  await ProjectDeleter.promises.deleteProject(projectId)
}

try {
  await scriptRunner(main)
  console.log('Done.')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
