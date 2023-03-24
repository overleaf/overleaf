import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'
import ChangeList from './change-list/change-list'
import Editor from './editor/editor'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useHistoryContext } from '../context/history-context'

const fileTreeContainer = document.getElementById('history-file-tree')

export default function HistoryRoot() {
  const { view } = useLayoutContext()
  const { updates } = useHistoryContext()

  return (
    <>
      {fileTreeContainer
        ? createPortal(<HistoryFileTree />, fileTreeContainer)
        : null}
      {view === 'history' && updates.length > 0 && (
        <div className="history-react">
          <Editor />
          <ChangeList />
        </div>
      )}
    </>
  )
}
