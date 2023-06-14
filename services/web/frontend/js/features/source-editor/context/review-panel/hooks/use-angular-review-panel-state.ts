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
  const [permissions] =
    useScopeValue<ReviewPanel.Value<'permissions'>>('permissions')

  const [wantTrackChanges] = useScopeValue<
    ReviewPanel.Value<'wantTrackChanges'>
  >('editor.wantTrackChanges')
  const [shouldCollapse, setShouldCollapse] = useScopeValue<
    ReviewPanel.Value<'shouldCollapse'>
  >('reviewPanel.fullTCStateCollapsed')

  const [toggleTrackChangesForEveryone] = useScopeValue<
    ReviewPanel.Value<'toggleTrackChangesForEveryone'>
  >('toggleTrackChangesForEveryone')
  const [toggleTrackChangesForUser] = useScopeValue<
    ReviewPanel.Value<'toggleTrackChangesForUser'>
  >('toggleTrackChangesForUser')
  const [toggleTrackChangesForGuests] = useScopeValue<
    ReviewPanel.Value<'toggleTrackChangesForGuests'>
  >('toggleTrackChangesForGuests')

  const [trackChangesState] = useScopeValue<
    ReviewPanel.Value<'trackChangesState'>
  >('reviewPanel.trackChangesState')
  const [trackChangesOnForEveryone] = useScopeValue<
    ReviewPanel.Value<'trackChangesOnForEveryone'>
  >('reviewPanel.trackChangesOnForEveryone')
  const [trackChangesOnForGuests] = useScopeValue<
    ReviewPanel.Value<'trackChangesOnForGuests'>
  >('reviewPanel.trackChangesOnForGuests')
  const [trackChangesForGuestsAvailable] = useScopeValue<
    ReviewPanel.Value<'trackChangesForGuestsAvailable'>
  >('reviewPanel.trackChangesForGuestsAvailable')

  const [formattedProjectMembers] = useScopeValue<
    ReviewPanel.Value<'formattedProjectMembers'>
  >('reviewPanel.formattedProjectMembers')

  const values = useMemo<ReviewPanelState['values']>(
    () => ({
      collapsed,
      permissions,
      subView,
      shouldCollapse,
      wantTrackChanges,
      toggleTrackChangesForEveryone,
      toggleTrackChangesForUser,
      toggleTrackChangesForGuests,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
    }),
    [
      collapsed,
      permissions,
      subView,
      shouldCollapse,
      wantTrackChanges,
      toggleTrackChangesForEveryone,
      toggleTrackChangesForUser,
      toggleTrackChangesForGuests,
      trackChangesState,
      trackChangesOnForEveryone,
      trackChangesOnForGuests,
      trackChangesForGuestsAvailable,
      formattedProjectMembers,
    ]
  )

  const updaterFns = useMemo<ReviewPanelState['updaterFns']>(
    () => ({
      setSubView,
      setCollapsed,
      setShouldCollapse,
    }),
    [setSubView, setCollapsed, setShouldCollapse]
  )

  return { values, updaterFns }
}

export default useAngularReviewPanelState
