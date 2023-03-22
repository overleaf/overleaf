import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'

export default function HistoryRoot() {
  const fileTreeContainer = document.getElementById('history-file-tree')

  return (
    <>
      {fileTreeContainer
        ? createPortal(<HistoryFileTree />, fileTreeContainer)
        : null}
      History
    </>
  )
}
