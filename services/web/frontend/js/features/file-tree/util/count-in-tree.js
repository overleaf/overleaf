export function countFiles(fileTreeData) {
  if (!fileTreeData) {
    return 0
  }

  const files = filesInFolder(fileTreeData)

  // count all the non-deleted entities
  const value = files.filter(item => !item.deleted).length

  const limit = window.ExposedSettings.maxEntitiesPerProject
  const status = fileCountStatus(value, limit, Math.ceil(limit / 20))

  return { value, status, limit }
}

function filesInFolder({ docs, folders, fileRefs }) {
  const files = [...docs, ...fileRefs]

  for (const folder of folders) {
    files.push(...filesInFolder(folder))
  }

  return files
}

function fileCountStatus(value, limit, range) {
  if (value >= limit) {
    return 'error'
  }

  if (value >= limit - range) {
    return 'warning'
  }

  return 'success'
}
