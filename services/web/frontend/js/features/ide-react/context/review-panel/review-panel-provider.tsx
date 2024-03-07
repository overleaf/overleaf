import useReviewPanelState from '@/features/ide-react/context/review-panel/hooks/use-review-panel-state'
import {
  ReviewPanelUpdaterFnsContext,
  ReviewPanelValueContext,
} from '@/features/source-editor/context/review-panel/review-panel-context'

const ReviewPanelReactIdeProvider: React.FC = ({ children }) => {
  const { values, updaterFns } = useReviewPanelState()

  return (
    <ReviewPanelValueContext.Provider value={values}>
      <ReviewPanelUpdaterFnsContext.Provider value={updaterFns}>
        {children}
      </ReviewPanelUpdaterFnsContext.Provider>
    </ReviewPanelValueContext.Provider>
  )
}

export default ReviewPanelReactIdeProvider
