import { useMemo } from 'react'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import { ReviewPanelState } from '../types/review-panel-state'
import * as ReviewPanel from '../types/review-panel-state'

function useAngularReviewPanelState(): ReviewPanelState {
  const [subView, setSubView] = useScopeValue<ReviewPanel.Value<'subView'>>(
    'reviewPanel.subView'
  )
  const [collapsed, setCollapsed] = useScopeValue<
    ReviewPanel.Value<'collapsed'>
  >('reviewPanel.overview.docsCollapsedState')

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

export default useAngularReviewPanelState
