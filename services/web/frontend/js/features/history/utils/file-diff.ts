import type { FileDiff, FileRemoved, FileRenamed } from '../services/types/file'

export function isFileRenamed(fileDiff: FileDiff): fileDiff is FileRenamed {
  return (fileDiff as FileRenamed).operation === 'renamed'
}

export function isFileRemoved(fileDiff: FileDiff): fileDiff is FileRemoved {
  return (fileDiff as FileRemoved).operation === 'removed'
}

export function fileFinalPathname(fileDiff: FileDiff) {
  return isFileRenamed(fileDiff) ? fileDiff.newPathname : fileDiff.pathname
}
