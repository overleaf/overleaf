const { ReadPreference } = require('mongodb')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')

async function main() {
  await waitForDb()
  const projects = db.projects.find(
    {},
    { projection: { rootFolder: 1 }, readPreference: ReadPreference.SECONDARY }
  )
  let projectsProcessed = 0
  for await (const project of projects) {
    projectsProcessed += 1
    if (projectsProcessed % 100000 === 0) {
      console.log(projectsProcessed, 'projects processed')
    }
    processProject(project)
  }
}

function processProject(project) {
  if (!project.rootFolder || !Array.isArray(project.rootFolder)) {
    console.log('BAD PATH:', project._id, 'rootFolder')
    return
  }
  if (!project.rootFolder[0]) {
    console.log('BAD PATH:', project._id, 'rootFolder.0')
    return
  }
  const badPaths = findBadPaths(project.rootFolder[0])
  for (const path of badPaths) {
    console.log('BAD PATH:', project._id, `rootFolder.0.${path}`)
  }
}

function findBadPaths(folder) {
  const result = []
  for (const attr of ['docs', 'fileRefs', 'folders']) {
    if (folder[attr] && !Array.isArray(folder[attr])) {
      result.push(attr)
    }
  }
  if (folder.folders && Array.isArray(folder.folders)) {
    for (const [i, subfolder] of folder.folders.entries()) {
      if (!subfolder) {
        result.push(`folders.${i}`)
        continue
      }
      for (const badPath of findBadPaths(subfolder)) {
        result.push(`folders.${i}.${badPath}`)
      }
    }
  }
  return result
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
