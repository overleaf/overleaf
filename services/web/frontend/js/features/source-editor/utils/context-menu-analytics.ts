import { sendMB } from '@/infrastructure/event-tracking'

export type ContextMenuItemSegmentation =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'paste-without-formatting'
  | 'paste-with-formatting'
  | 'give-feedback'
  | 'delete'
  | 'jump-to-location-in-pdf'
  | 'suggest-edits'
  | 'back-to-editing'
  | 'comment'

export type ContextMenuAnalyticsEvents = {
  'menu-expand': {
    location: 'editor-context-menu'
  }
  'menu-click': {
    location: 'editor-context-menu'
    item: ContextMenuItemSegmentation
  }
  'jump-to-location': {
    method: 'editor-context-menu'
    direction: 'code-location-in-pdf'
  }
  'add-comment': {
    location: 'editor-context-menu'
  }
  'paywall-prompt': {
    'paywall-type': 'track-changes'
    location: 'editor-context-menu'
  }
}

export const sendContextMenuEvent = <
  T extends keyof ContextMenuAnalyticsEvents,
>(
  eventName: T,
  segmentation: ContextMenuAnalyticsEvents[T]
) => {
  sendMB(eventName, segmentation)
}
