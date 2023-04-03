import ChangeList from './change-list/change-list'
import DiffView from './diff-view/diff-view'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { HistoryProvider, useHistoryContext } from '../context/history-context'
import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'
import getMeta from '../../../utils/meta'

const fileTreeContainer = document.getElementById('history-file-tree')

function Main() {
  const { view } = useLayoutContext()
  const { updates } = useHistoryContext()

  if (view !== 'history' || updates.length === 0) {
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
  const isReact = getMeta('ol-splitTestVariants')?.['history-view'] === 'react'

  if (!isReact) {
    return null
  }

  return (
    <HistoryProvider>
      <Main />
    </HistoryProvider>
  )
}
