import { LoadingPane } from '@/features/ide-react/components/editor/loading-pane'
import {
  EditorScopeValue,
  useEditorManagerContext,
} from '@/features/ide-react/context/editor-manager-context'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import useScopeValue from '@/shared/hooks/use-scope-value'
import classNames from 'classnames'
import SourceEditor from '@/features/source-editor/components/source-editor'

export const Editor = () => {
  const [editor] = useScopeValue<EditorScopeValue>('editor')
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
