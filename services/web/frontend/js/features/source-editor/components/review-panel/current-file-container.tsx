import { memo, useMemo } from 'react'
import Container from './container'
import Toolbar from './toolbar/toolbar'
import Nav from './nav'
import Toggler from './toggler'
import PositionedEntries from './positioned-entries'
import { useReviewPanelValueContext } from '../../context/review-panel/review-panel-context'
import useCodeMirrorContentHeight from '../../hooks/use-codemirror-content-height'
import { ReviewPanelEntry } from '../../../../../../types/review-panel/entry'
import { ReviewPanelDocEntries } from '../../../../../../types/review-panel/review-panel'
import Entry from './entry'
import EmptyState from './empty-state'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function CurrentFileContainer() {
  const { entries, openDocId } = useReviewPanelValueContext()
  const contentHeight = useCodeMirrorContentHeight()

  const currentDocEntries =
    openDocId && openDocId in entries ? entries[openDocId] : undefined

  const objectEntries = useMemo(() => {
    return Object.entries(currentDocEntries || {}) as Array<
      [keyof ReviewPanelDocEntries, ReviewPanelEntry]
    >
  }, [currentDocEntries])

  const enableEmptyState = useFeatureFlag('review-panel-redesign')

  const showEmptyState =
    enableEmptyState &&
    objectEntries.filter(
      ([key]) => key !== 'add-comment' && key !== 'bulk-actions'
    ).length === 0

  return (
    <Container className="rp-current-file-container">
      <div className="review-panel-tools">
        <Toolbar />
        {showEmptyState && <EmptyState />}
        <Nav />
      </div>
      <Toggler />
      <div
        id="review-panel-current-file"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby="review-panel-tab-current-file"
      >
        <PositionedEntries
          entries={objectEntries}
          contentHeight={contentHeight}
        >
          {openDocId &&
            objectEntries.map(([id, entry]) => {
              return <Entry key={id} id={id} entry={entry} />
            })}
        </PositionedEntries>
      </div>
    </Container>
  )
}

export default memo(CurrentFileContainer)
