import type { Nullable } from '../../../../../types/utils'
import type { FileDiff } from '../services/types/file'
import type { FileOperation } from '../services/types/file-operation'
import type { LoadedUpdate, Version } from '../services/types/update'
import type { Selection } from '../services/types/selection'
import { fileFinalPathname, isFileEditable } from './file-diff'

type FileWithOps = {
  pathname: FileDiff['pathname']
  editable: boolean
  operation: FileOperation
}

function getFilesWithOps(
  files: FileDiff[],
  toV: Version,
  comparing: boolean,
  updateForToV: LoadedUpdate | undefined
): FileWithOps[] {
  if (toV && !comparing) {
    const filesWithOps: FileWithOps[] = []

    if (updateForToV) {
      const filesByPathname = new Map<string, FileDiff>()
      for (const file of files) {
        const pathname = fileFinalPathname(file)
        filesByPathname.set(pathname, file)
      }

      const isEditable = (pathname: string) => {
        const fileDiff = filesByPathname.get(pathname)
        if (!fileDiff) {
          return false
        }
        return isFileEditable(fileDiff)
      }

      for (const pathname of updateForToV.pathnames) {
        filesWithOps.push({
          pathname,
          editable: isEditable(pathname),
          operation: 'edited',
        })
      }

      for (const op of updateForToV.project_ops) {
        let pathAndOp: Nullable<Pick<FileWithOps, 'pathname' | 'operation'>> =
          null

        if (op.add) {
          pathAndOp = {
            pathname: op.add.pathname,
            operation: 'added',
          }
        } else if (op.remove) {
          pathAndOp = {
            pathname: op.remove.pathname,
            operation: 'removed',
          }
        } else if (op.rename) {
          pathAndOp = {
            pathname: op.rename.newPathname,
            operation: 'renamed',
          }
        }

        if (pathAndOp !== null) {
          filesWithOps.push({
            editable: isEditable(pathAndOp.pathname),
            ...pathAndOp,
          })
        }
      }
    }

    return filesWithOps
  } else {
    const filesWithOps = files.reduce((curFilesWithOps, file) => {
      if ('operation' in file) {
        curFilesWithOps.push({
          pathname: file.pathname,
          editable: isFileEditable(file),
          operation: file.operation,
        })
      }
      return curFilesWithOps
    }, <FileWithOps[]>[])

    return filesWithOps
  }
}

const orderedOpTypes: FileOperation[] = [
  'edited',
  'added',
  'renamed',
  'removed',
]

export function autoSelectFile(
  files: FileDiff[],
  toV: Version,
  comparing: boolean,
  updateForToV: LoadedUpdate | undefined,
  previouslySelectedPathname: Selection['previouslySelectedPathname']
): FileDiff {
  const filesWithOps = getFilesWithOps(files, toV, comparing, updateForToV)
  const previouslySelectedFile = files.find(file => {
    return file.pathname === previouslySelectedPathname
  })
  const previouslySelectedFileHasOp = filesWithOps.some(file => {
    return file.pathname === previouslySelectedPathname
  })

  if (previouslySelectedFile && previouslySelectedFileHasOp) {
    return previouslySelectedFile
  }

  for (const opType of orderedOpTypes) {
    const fileWithMatchingOpType = filesWithOps.find(
      file => file.operation === opType && file.editable
    )

    if (fileWithMatchingOpType) {
      const fileToSelect = files.find(
        file => fileFinalPathname(file) === fileWithMatchingOpType.pathname
      )
      if (fileToSelect) {
        return fileToSelect
      }
    }
  }

  return (
    previouslySelectedFile ||
    files.find(file => /main\.tex$/.test(file.pathname)) ||
    files.find(file => /\.tex$/.test(file.pathname)) ||
    files[0]
  )
}
