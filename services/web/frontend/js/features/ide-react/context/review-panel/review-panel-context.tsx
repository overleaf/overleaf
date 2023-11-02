import { useContext, createContext } from 'react'
import useReviewPanelState from '@/features/ide-react/context/review-panel/hooks/use-review-panel-state'
import { ReviewPanelStateReactIde } from '@/features/ide-react/context/review-panel/types/review-panel-state'

export const ReviewPanelReactIdeValueContext = createContext<
  ReviewPanelStateReactIde['values'] | undefined
>(undefined)

export const ReviewPanelReactIdeUpdaterFnsContext = createContext<
  ReviewPanelStateReactIde['updaterFns'] | undefined
>(undefined)

export const ReviewPanelReactIdeProvider: React.FC = ({ children }) => {
  const { values, updaterFns } = useReviewPanelState()

  return (
    <ReviewPanelReactIdeValueContext.Provider value={values}>
      <ReviewPanelReactIdeUpdaterFnsContext.Provider value={updaterFns}>
        {children}
      </ReviewPanelReactIdeUpdaterFnsContext.Provider>
    </ReviewPanelReactIdeValueContext.Provider>
  )
}

export function useReviewPanelReactIdeValueContext() {
  const context = useContext(ReviewPanelReactIdeValueContext)
  if (!context) {
    throw new Error(
      'ReviewPanelReactIdeValueContext is only available inside ReviewPanelReactIdeProvider'
    )
  }
  return context
}

export function useReviewPanelReactIdeUpdaterFnsContext() {
  const context = useContext(ReviewPanelReactIdeUpdaterFnsContext)
  if (!context) {
    throw new Error(
      'ReviewPanelReactIdeUpdaterFnsContext is only available inside ReviewPanelReactIdeProvider'
    )
  }
  return context
}
