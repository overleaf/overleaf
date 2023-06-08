import { createContext, useContext, useMemo } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { SubView } from '../components/review-panel/nav'

interface ReviewPanelState {
  values: {
    subView: SubView
    collapsed: Record<string, boolean>
  }
  updaterFns: {
    setSubView: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['subView']>
    >
    setCollapsed: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['collapsed']>
    >
  }
}

function useAngularReviewPanelState(): ReviewPanelState {
  const [subView, setSubView] = useScopeValue<SubView>('reviewPanel.subView')
  const [collapsed, setCollapsed] = useScopeValue<Record<string, boolean>>(
    'reviewPanel.overview.docsCollapsedState'
  )

  const values = useMemo<ReviewPanelState['values']>(
    () => ({
      subView,
      collapsed,
    }),
    [subView, collapsed]
  )

  const updaterFns = useMemo<ReviewPanelState['updaterFns']>(
    () => ({
      setSubView,
      setCollapsed,
    }),
    [setSubView, setCollapsed]
  )

  return { values, updaterFns }
}

const ReviewPanelStateValueContext = createContext<
  ReviewPanelState['values'] | undefined
>(undefined)

type ReviewPanelStateValueProps = {
  children?: React.ReactNode
  value: ReviewPanelState['values']
}

function ReviewPanelStateValueProvider(props: ReviewPanelStateValueProps) {
  return <ReviewPanelStateValueContext.Provider {...props} />
}

const ReviewPanelStateUpdaterFnsContext = createContext<
  ReviewPanelState['updaterFns'] | undefined
>(undefined)

type ReviewPanelStateUpdaterFnsProviderProps = {
  children?: React.ReactNode
  value: ReviewPanelState['updaterFns']
}

function ReviewPanelStateUpdaterFnsProvider(
  props: ReviewPanelStateUpdaterFnsProviderProps
) {
  return <ReviewPanelStateUpdaterFnsContext.Provider {...props} />
}

type ReviewPanelStateProviderProps = {
  children?: React.ReactNode
}

export function ReviewPanelStateProvider({
  children,
}: ReviewPanelStateProviderProps) {
  const { values, updaterFns } = useAngularReviewPanelState()

  return (
    <ReviewPanelStateValueProvider value={values}>
      <ReviewPanelStateUpdaterFnsProvider value={updaterFns}>
        {children}
      </ReviewPanelStateUpdaterFnsProvider>
    </ReviewPanelStateValueProvider>
  )
}

export function useReviewPanelStateValueContext() {
  const context = useContext(ReviewPanelStateValueContext)
  if (!context) {
    throw new Error(
      'ReviewPanelStateValueContext is only available inside ReviewPanelStateProvider'
    )
  }
  return context
}

export function useReviewPanelStateUpdaterFnsContext() {
  const context = useContext(ReviewPanelStateUpdaterFnsContext)
  if (!context) {
    throw new Error(
      'ReviewPanelStateUpdaterFnsContext is only available inside ReviewPanelStateProvider'
    )
  }
  return context
}
