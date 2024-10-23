import Container from './container'
import Toggler from './toggler'
import Toolbar from './toolbar/toolbar'
import Nav from './nav'
import OverviewFile from './overview-file'
import { useReviewPanelValueContext } from '../../context/review-panel/review-panel-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { memo } from 'react'
import LoadingSpinner from '@/shared/components/loading-spinner'

function OverviewContainer() {
  const { isOverviewLoading } = useReviewPanelValueContext()
  const { docs } = useFileTreeData()

  return (
    <Container>
      <Toggler />
      <Toolbar />
      <div
        className="rp-entry-list"
        id="review-panel-overview"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby="review-panel-tab-overview"
      >
        {isOverviewLoading ? (
          <LoadingSpinner className="d-flex justify-content-center my-2" />
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
