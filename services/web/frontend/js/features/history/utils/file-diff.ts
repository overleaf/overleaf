import type {
  FileDiff,
  FileRemoved,
  FileRenamed,
  FileWithEditable,
} from '../services/types/file'

export function isFileRenamed(fileDiff: FileDiff): fileDiff is FileRenamed {
  return (fileDiff as FileRenamed).operation === 'renamed'
}

export function isFileRemoved(fileDiff: FileDiff): fileDiff is FileRemoved {
  return (fileDiff as FileRemoved).operation === 'removed'
}

function isFileWithEditable(fileDiff: FileDiff): fileDiff is FileWithEditable {
  return 'editable' in (fileDiff as FileWithEditable)
}

export function isFileEditable(fileDiff: FileDiff) {
  return isFileWithEditable(fileDiff)
    ? fileDiff.editable
    : fileDiff.operation === 'edited'
}

export function fileFinalPathname(fileDiff: FileDiff) {
  return (
    (isFileRenamed(fileDiff) ? fileDiff.newPathname : null) || fileDiff.pathname
  )
}
