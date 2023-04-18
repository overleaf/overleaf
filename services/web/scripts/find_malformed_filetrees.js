const {
  db,
  waitForDb,
  READ_PREFERENCE_SECONDARY,
} = require('../app/src/infrastructure/mongodb')

async function main() {
  await waitForDb()
  const projects = db.projects.find(
    {},
    {
      projection: { rootFolder: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
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

  if (!folder._id) {
    result.push('_id')
  }

  if (typeof folder.name !== 'string' || !folder.name) {
    result.push('name')
  }

  if (folder.folders) {
    if (Array.isArray(folder.folders)) {
      for (const [i, subfolder] of folder.folders.entries()) {
        if (!subfolder || typeof subfolder !== 'object') {
          result.push(`folders.${i}`)
          continue
        }
        for (const badPath of findBadPaths(subfolder)) {
          result.push(`folders.${i}.${badPath}`)
        }
      }
    } else {
      result.push('folders')
    }
  }

  if (folder.docs) {
    if (Array.isArray(folder.docs)) {
      for (const [i, doc] of folder.docs.entries()) {
        if (!doc || typeof doc !== 'object') {
          result.push(`docs.${i}`)
          continue
        }
        if (!doc._id) {
          result.push(`docs.${i}._id`)
          // no need to check further: this doc can be deleted
          continue
        }
        if (typeof doc.name !== 'string' || !doc.name) {
          result.push(`docs.${i}.name`)
        }
      }
    } else {
      result.push('docs')
    }
  }

  if (folder.fileRefs) {
    if (Array.isArray(folder.fileRefs)) {
      for (const [i, file] of folder.fileRefs.entries()) {
        if (!file || typeof file !== 'object') {
          result.push(`fileRefs.${i}`)
          continue
        }
        if (!file._id) {
          result.push(`fileRefs.${i}._id`)
          // no need to check further: this file can be deleted
          continue
        }
        if (typeof file.name !== 'string' || !file.name) {
          result.push(`fileRefs.${i}.name`)
        }
      }
    } else {
      result.push('fileRefs')
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
