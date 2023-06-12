import { SubView } from '../../../components/review-panel/nav'

export interface ReviewPanelState {
  values: {
    collapsed: Record<string, boolean>
    subView: SubView
  }
  updaterFns: {
    setCollapsed: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['collapsed']>
    >
    setSubView: React.Dispatch<
      React.SetStateAction<ReviewPanelState['values']['subView']>
    >
  }
}

// Getter for values
export type Value<T extends keyof ReviewPanelState['values']> =
  ReviewPanelState['values'][T]
