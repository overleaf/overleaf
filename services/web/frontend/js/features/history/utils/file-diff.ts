import {
  FileChanged,
  FileDiff,
  FileRemoved,
  FileRenamed,
} from '../services/types/file'

export function isFileChanged(fileDiff: FileDiff): fileDiff is FileChanged {
  return 'operation' in fileDiff
}

export function isFileRenamed(fileDiff: FileDiff): fileDiff is FileRenamed {
  return isFileChanged(fileDiff) && fileDiff.operation === 'renamed'
}

export function isFileRemoved(fileDiff: FileDiff): fileDiff is FileRemoved {
  return isFileChanged(fileDiff) && fileDiff.operation === 'removed'
}

export function isFileEditable(fileDiff: FileDiff) {
  return 'editable' in fileDiff
    ? fileDiff.editable
    : fileDiff.operation === 'edited'
}

export function fileFinalPathname(fileDiff: FileDiff) {
  return (
    (isFileRenamed(fileDiff) ? fileDiff.newPathname : null) || fileDiff.pathname
  )
}
