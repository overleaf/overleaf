import ChangeList from './change-list/change-list'
import DiffView from './diff-view/diff-view'
import { HistoryProvider, useHistoryContext } from '../context/history-context'
import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'

const fileTreeContainer = document.getElementById('history-file-tree')

function Main() {
  const { updates } = useHistoryContext()

  if (updates.length === 0) {
    return null
  }

  return (
    <>
      {fileTreeContainer
        ? createPortal(<HistoryFileTree />, fileTreeContainer)
        : null}
      <div className="history-react">
        <DiffView />
        <ChangeList />
      </div>
    </>
  )
}

export default function HistoryRoot() {
  return (
    <HistoryProvider>
      <Main />
    </HistoryProvider>
  )
}
