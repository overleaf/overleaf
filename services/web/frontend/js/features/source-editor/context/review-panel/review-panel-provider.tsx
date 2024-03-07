import useAngularReviewPanelState from '@/features/source-editor/context/review-panel/hooks/use-angular-review-panel-state'
import { FC } from 'react'
import {
  ReviewPanelUpdaterFnsContext,
  ReviewPanelValueContext,
} from './review-panel-context'

const ReviewPanelProvider: FC = ({ children }) => {
  const { values, updaterFns } = useAngularReviewPanelState()

  return (
    <ReviewPanelValueContext.Provider value={values}>
      <ReviewPanelUpdaterFnsContext.Provider value={updaterFns}>
        {children}
      </ReviewPanelUpdaterFnsContext.Provider>
    </ReviewPanelValueContext.Provider>
  )
}

export default ReviewPanelProvider
