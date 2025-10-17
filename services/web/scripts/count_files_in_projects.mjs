import readline from 'node:readline'
import ProjectEntityHandler from '../app/src/Features/Project/ProjectEntityHandler.mjs'
import ProjectGetter from '../app/src/Features/Project/ProjectGetter.mjs'
import Errors from '../app/src/Features/Errors/Errors.js'

async function countFiles() {
  const rl = readline.createInterface({
    input: process.stdin,
  })

  for await (const projectId of rl) {
    try {
      const project = await ProjectGetter.promises.getProject(projectId)
      if (!project) {
        throw new Errors.NotFoundError('project not found')
      }
      const { files, docs } =
        ProjectEntityHandler.getAllEntitiesFromProject(project)
      console.error(
        projectId,
        files.length,
        docs.length,
        (project.deletedDocs && project.deletedDocs.length) || 0
      )
    } catch (err) {
      if (err instanceof Errors.NotFoundError) {
        console.error(projectId, 'NOTFOUND')
      } else {
        console.log(projectId, 'ERROR', err.name, err.message)
      }
    }
  }
}

try {
  await countFiles()
  process.exit(0)
} catch (error) {
  console.log('Aiee, something went wrong!', error)
  process.exit(1)
}
