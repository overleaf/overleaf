import { LoadingPane } from '@/features/ide-react/components/editor/loading-pane'
import {
  EditorScopeValue,
  useEditorManagerContext,
} from '@/features/ide-react/context/editor-manager-context'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import useScopeValue from '@/shared/hooks/use-scope-value'
import classNames from 'classnames'
import SourceEditor from '@/features/source-editor/components/source-editor'
import { useProjectContext } from '@/shared/context/project-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useEffect, useRef } from 'react'
import { findInTree } from '@/features/file-tree/util/find-in-tree'

// FIXME: This is only needed until we have a working file tree. This hook does
//        the minimal amount of work to load the initial document.
const useWorkaroundForOpeningInitialDocument = () => {
  const { _id: projectId } = useProjectContext()
  const { fileTreeData, setSelectedEntities } = useFileTreeData()
  const isReady = Boolean(projectId && fileTreeData)
  const { handleFileTreeInit, handleFileTreeSelect } = useFileTreeOpenContext()
  const { currentDocumentId } = useEditorManagerContext()

  useEffect(() => {
    if (isReady) handleFileTreeInit()
  }, [isReady, handleFileTreeInit])

  const alreadyOpenedFile = useRef(false)
  useEffect(() => {
    if (isReady && currentDocumentId && !alreadyOpenedFile.current) {
      alreadyOpenedFile.current = true
      const doc = findInTree(fileTreeData, currentDocumentId)
      if (doc) {
        handleFileTreeSelect([doc])
        setSelectedEntities([doc])
      }
    }
  }, [
    isReady,
    currentDocumentId,
    fileTreeData,
    handleFileTreeSelect,
    setSelectedEntities,
  ])
}

export const Editor = () => {
  const [editor] = useScopeValue<EditorScopeValue>('editor')
  useWorkaroundForOpeningInitialDocument()
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()
  const { currentDocumentId } = useEditorManagerContext()

  if (!currentDocumentId) {
    return null
  }

  const isLoading = Boolean(
    (!editor.sharejs_doc || editor.opening) &&
      !editor.error_state &&
      editor.open_doc_id
  )

  return (
    <div
      className={classNames('ide-redesign-editor-content', {
        hidden: openEntity?.type !== 'doc' || selectedEntityCount !== 1,
      })}
    >
      <SourceEditor />
      {isLoading && <LoadingPane />}
    </div>
  )
}
