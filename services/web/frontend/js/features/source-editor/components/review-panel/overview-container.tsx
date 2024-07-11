import Container from './container'
import Toggler from './toggler'
import Toolbar from './toolbar/toolbar'
import Nav from './nav'
import Icon from '../../../../shared/components/icon'
import OverviewFile from './overview-file'
import { useReviewPanelValueContext } from '../../context/review-panel/review-panel-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { memo, useMemo } from 'react'
import EmptyState from './empty-state'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function OverviewContainer() {
  const { entries } = useReviewPanelValueContext()

  const { isOverviewLoading } = useReviewPanelValueContext()
  const { docs } = useFileTreeData()

  const entryCount = useMemo(() => {
    return docs
      ?.map(doc => {
        const docEntries = entries[doc.doc.id] ?? {}
        return Object.keys(docEntries).filter(
          key => key !== 'add-comment' && key !== 'bulk-actions'
        ).length
      })
      .reduce((acc, curr) => acc + curr, 0)
  }, [docs, entries])

  const enableEmptyState = useFeatureFlag('review-panel-redesign')

  return (
    <Container>
      <Toggler />
      {enableEmptyState && entryCount === 0 && <EmptyState />}
      <Toolbar />
      <div
        className="rp-entry-list"
        id="review-panel-overview"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby="review-panel-tab-overview"
      >
        {isOverviewLoading ? (
          <div className="rp-loading">
            <Icon type="spinner" spin />
          </div>
        ) : (
          docs?.map(doc => (
            <OverviewFile
              key={doc.doc.id}
              docId={doc.doc.id}
              docPath={doc.path}
            />
          ))
        )}
      </div>
      <Nav />
    </Container>
  )
}

export default memo(OverviewContainer)
