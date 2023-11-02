import { ReviewPanelState } from '@/features/source-editor/context/review-panel/types/review-panel-state'

export interface ReviewPanelStateReactIde extends ReviewPanelState {}

// Getter for values
export type Value<T extends keyof ReviewPanelStateReactIde['values']> =
  ReviewPanelStateReactIde['values'][T]

// Getter for stable functions
export type UpdaterFn<T extends keyof ReviewPanelStateReactIde['updaterFns']> =
  ReviewPanelStateReactIde['updaterFns'][T]
