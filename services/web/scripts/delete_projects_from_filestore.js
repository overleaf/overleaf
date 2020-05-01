const readline = require('readline')
const { Project } = require('../app/src/models/Project')
const FileStoreHandler = require('../app/src/Features/FileStore/FileStoreHandler')
const { DeletedProject } = require('../app/src/models/DeletedProject')

/* eslint-disable no-console */

async function deleteFiles() {
  const rl = readline.createInterface({
    input: process.stdin
  })

  for await (const projectId of rl) {
    try {
      const projectCount = await Project.count({ _id: projectId }).exec()
      if (projectCount > 0) {
        throw new Error('found an existing project - refusing')
      }
      const count = await DeletedProject.count({
        'deleterData.deletedProjectId': projectId,
        project: { $ne: null }
      }).exec()
      if (count > 0) {
        throw new Error('found an existing deleted project - refusing')
      }
      await FileStoreHandler.promises.deleteProject(projectId)
      console.error(projectId, 'OK')
    } catch (err) {
      console.error(projectId, 'ERROR', err.name, err.message)
    }
  }
}

deleteFiles()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.log('Aiee, something went wrong!', err)
    process.exit(1)
  })
