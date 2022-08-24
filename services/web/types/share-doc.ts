import EventEmitter from 'events'

// type for the Doc class in vendor/libs/sharejs.js
export interface ShareDoc extends EventEmitter {
  detach_cm6?: () => void
  getText: () => string
  insert: (pos: number, insert: string, fromUndo: boolean) => void
  del: (pos: number, length: number, fromUndo: boolean) => void
}
