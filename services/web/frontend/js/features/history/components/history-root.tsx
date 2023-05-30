import ChangeList from './change-list/change-list'
import DiffView from './diff-view/diff-view'
import { HistoryProvider, useHistoryContext } from '../context/history-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { createPortal } from 'react-dom'
import HistoryFileTree from './history-file-tree'
import LoadingSpinner from '../../../shared/components/loading-spinner'
import { ErrorBoundaryFallback } from '../../../shared/components/error-boundary-fallback'
import withErrorBoundary from '../../../infrastructure/error-boundary'

const fileTreeContainer = document.getElementById('history-file-tree')

function Main() {
  const { view } = useLayoutContext()
  const { updatesInfo } = useHistoryContext()

  if (view !== 'history') {
    return null
  }

  let content
  if (updatesInfo.loadingState === 'loadingInitial') {
    content = <LoadingSpinner />
  } else {
    content = (
      <>
        <DiffView />
        <ChangeList />
      </>
    )
  }

  return (
    <>
      {fileTreeContainer
        ? createPortal(<HistoryFileTree />, fileTreeContainer)
        : null}
      <div className="history-react">{content}</div>
    </>
  )
}

function HistoryRoot() {
  return (
    <HistoryProvider>
      <Main />
    </HistoryProvider>
  )
}

export default withErrorBoundary(HistoryRoot, ErrorBoundaryFallback)
