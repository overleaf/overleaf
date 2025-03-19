import { FC } from 'react'
import { RangesProvider } from './ranges-context'
import { ChangesUsersProvider } from './changes-users-context'
import { TrackChangesStateProvider } from './track-changes-state-context'
import { ThreadsProvider } from './threads-context'
import { ReviewPanelViewProvider } from './review-panel-view-context'

export const ReviewPanelProviders: FC = ({ children }) => {
  return (
    <ReviewPanelViewProvider>
      <ChangesUsersProvider>
        <TrackChangesStateProvider>
          <ThreadsProvider>
            <RangesProvider>{children}</RangesProvider>
          </ThreadsProvider>
        </TrackChangesStateProvider>
      </ChangesUsersProvider>
    </ReviewPanelViewProvider>
  )
}
