import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'
import ChangeList from './change-list/change-list'
import Editor from './editor/editor'

const fileTreeContainer = document.getElementById('history-file-tree')

export default function HistoryRoot() {
  return (
    <>
      {fileTreeContainer
        ? createPortal(<HistoryFileTree />, fileTreeContainer)
        : null}
      <div className="history-react">
        <ChangeList />
        <Editor />
      </div>
    </>
  )
}
