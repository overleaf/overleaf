import { debugConsole } from '@/utils/debugging'

type EditorEvent = { type: string; meta: unknown; date: Date }

// Record events and then do nothing with them.
export class EventLog {
  private recentEvents: EditorEvent[] = []

  pushEvent = (type: string, meta: unknown = {}) => {
    debugConsole.log('event', type, meta)
    this.recentEvents.push({ type, meta, date: new Date() })
    if (this.recentEvents.length > 100) {
      return this.recentEvents.shift()
    }
  }
}
