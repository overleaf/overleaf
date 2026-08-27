import { EditorLoadingPane } from '@/features/ide-react/components/editor/editor-loading-pane'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import classNames from 'classnames'
import SourceEditor from '@/features/source-editor/components/source-editor'
import { FC } from 'react'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

const [pythonRunnerModule] = importOverleafModules('pythonRunner') as {
  import: { PythonEditorSplit: FC }
}[]

export const Editor = () => {
  const { opening, errorState } = useEditorPropertiesContext()
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()
  const { currentDocumentId, currentDocument } = useEditorOpenDocContext()

  if (!currentDocumentId) {
    return null
  }

  const isLoading = Boolean(
    (!currentDocument || opening) && !errorState && currentDocumentId
  )

  const isPythonDocument =
    openEntity?.type === 'doc' &&
    openEntity.entity.name.toLowerCase().endsWith('.py')

  return (
    <div
      className={classNames('ide-redesign-editor-content', {
        hidden: openEntity?.type !== 'doc' || selectedEntityCount !== 1,
      })}
      style={{ minHeight: 0, overflow: 'hidden' }}
    >
      <div className="ide-redesign-editor-panel" style={{ height: '100%' }}>
        {pythonRunnerModule &&
        isPythonDocument &&
        isSplitTestEnabled('overleaf-code') ? (
          <pythonRunnerModule.import.PythonEditorSplit />
        ) : (
          <SourceEditor />
        )}
        {isLoading && <EditorLoadingPane />}
      </div>
    </div>
  )
}
