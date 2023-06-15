import {
  SubView,
  ReviewPanelPermissions,
} from '../../../../../../../types/review-panel'

export interface ReviewPanelState {
  values: {
    collapsed: Record<string, boolean>
    subView: SubView
    permissions: ReviewPanelPermissions
    shouldCollapse: boolean
    wantTrackChanges: boolean
    toggleTrackChangesForEveryone: (isOn: boolean) => unknown
    toggleTrackChangesForUser: (isOn: boolean, memberId: string) => unknown
    toggleTrackChangesForGuests: (isOn: boolean) => unknown
    trackChangesState: Record<string, { value: boolean; syncState: string }>
    trackChangesOnForEveryone: boolean
    trackChangesOnForGuests: boolean
    trackChangesForGuestsAvailable: boolean
    formattedProjectMembers: Record<
      string,
      {
        id: string
        name: string
      }
    >
    toggleReviewPanel: () => void
  }
  updaterFns: {
    setCollapsed: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['collapsed']>
    >
    setSubView: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['subView']>
    >
    setShouldCollapse: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['shouldCollapse']>
    >
  }
}

// Getter for values
export type Value<T extends keyof ReviewPanelState['values']> =
  ReviewPanelState['values'][T]
