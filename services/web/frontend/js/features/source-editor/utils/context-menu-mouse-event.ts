import { isMac } from '@/shared/utils/os'

export function isContextMenuMouseEvent(event: MouseEvent): boolean {
  return event.button === 2 || (isMac && event.button === 0 && event.ctrlKey)
}
