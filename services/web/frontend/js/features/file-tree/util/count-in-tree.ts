import getMeta from '@/utils/meta'
import { Folder } from '../../../../../types/folder'

type FileCountStatus = 'success' | 'warning' | 'error'

type FileCount = {
  value: number
  status: FileCountStatus
  limit: number
}

export function countFiles(fileTreeData: Folder | undefined): 0 | FileCount {
  if (!fileTreeData) {
    return 0
  }

  const value = _countElements(fileTreeData)

  const limit = getMeta('ol-ExposedSettings').maxEntitiesPerProject
  const status = fileCountStatus(value, limit, Math.ceil(limit / 20))

  return { value, status, limit }
}

function fileCountStatus(
  value: number,
  limit: number,
  range: number
): FileCountStatus {
  if (value >= limit) {
    return 'error'
  }

  if (value >= limit - range) {
    return 'warning'
  }

  return 'success'
}

// Copied and adapted from ProjectEntityMongoUpdateHandler
function _countElements(rootFolder: Folder): number {
  function countFolder(folder: Folder) {
    if (folder == null) {
      return 0
    }

    let total = 0
    if (folder.folders) {
      total += folder.folders.length
      for (const subfolder of folder.folders) {
        total += countFolder(subfolder)
      }
    }
    if (folder.docs) {
      total += folder.docs.length
    }
    if (folder.fileRefs) {
      total += folder.fileRefs.length
    }
    return total
  }

  return countFolder(rootFolder)
}
