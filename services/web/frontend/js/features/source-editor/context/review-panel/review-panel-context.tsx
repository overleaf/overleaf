import { createContext, useContext } from 'react'
import type { ReviewPanelState } from './types/review-panel-state'

export const ReviewPanelValueContext = createContext<
  ReviewPanelState['values'] | undefined
>(undefined)

export const ReviewPanelUpdaterFnsContext = createContext<
  ReviewPanelState['updaterFns'] | undefined
>(undefined)

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
