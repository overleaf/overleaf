import { useCallback } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { isMainFile } from '@/features/pdf-preview/util/editor-files'

export type RootDocInfo = {
  rootDocId: string | null
  rootResourcePath: string
}

export function useRootDoc(): () => RootDocInfo {
  const { project } = useProjectContext()
  const projectRootDocId = project?.rootDocId ?? null
  const { currentDocument } = useEditorOpenDocContext()
  const { pathInFolder } = useFileTreePathContext()

  // Inspecting the document content is too expensive to perform on every update.
  // Compute the rootDoc on-demand instead.
  return useCallback((): RootDocInfo => {
    let rootDocId: string | null = projectRootDocId
    if (
      currentDocument &&
      currentDocument.doc_id !== projectRootDocId &&
      isMainFile(currentDocument.getSnapshot())
    ) {
      rootDocId = currentDocument.doc_id
    }
    const rootResourcePath =
      (rootDocId && pathInFolder(rootDocId)) || 'main.tex'
    return { rootDocId, rootResourcePath }
  }, [projectRootDocId, currentDocument, pathInFolder])
}
