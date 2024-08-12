import { createContext, useContext } from 'react'
import type { ReviewPanelState } from './types/review-panel-state'
import useReviewPanelState from '@/features/ide-react/context/review-panel/hooks/use-review-panel-state'

export const ReviewPanelValueContext = createContext<
  ReviewPanelState['values'] | undefined
>(undefined)

export const ReviewPanelUpdaterFnsContext = createContext<
  ReviewPanelState['updaterFns'] | undefined
>(undefined)

export const ReviewPanelProvider: React.FC = ({ children }) => {
  const { values, updaterFns } = useReviewPanelState()

  return (
    <ReviewPanelValueContext.Provider value={values}>
      <ReviewPanelUpdaterFnsContext.Provider value={updaterFns}>
        {children}
      </ReviewPanelUpdaterFnsContext.Provider>
    </ReviewPanelValueContext.Provider>
  )
}

export function useReviewPanelValueContext() {
  const context = useContext(ReviewPanelValueContext)

  if (!context) {
    throw new Error(
      'ReviewPanelValueContext is only available inside ReviewPanelProvider'
    )
  }
  return context
}

export function useReviewPanelUpdaterFnsContext() {
  const context = useContext(ReviewPanelUpdaterFnsContext)

  if (!context) {
    throw new Error(
      'ReviewPanelUpdaterFnsContext is only available inside ReviewPanelProvider'
    )
  }
  return context
}
