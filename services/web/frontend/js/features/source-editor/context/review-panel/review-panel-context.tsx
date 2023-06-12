import { createContext, useContext } from 'react'
import useAngularReviewPanelState from './hooks/use-angular-review-panel'
import { ReviewPanelState } from './types/review-panel-state'

const ReviewPanelValueContext = createContext<
  ReviewPanelState['values'] | undefined
>(undefined)

const ReviewPanelUpdaterFnsContext = createContext<
  ReviewPanelState['updaterFns'] | undefined
>(undefined)

type ReviewPanelProviderProps = {
  children?: React.ReactNode
}

export function ReviewPanelProvider({ children }: ReviewPanelProviderProps) {
  const { values, updaterFns } = useAngularReviewPanelState()

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
