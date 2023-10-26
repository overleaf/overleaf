import { Emitter } from 'strict-event-emitter'
import { Project } from '../../../../types/project'
import { PermissionsLevel } from '@/features/ide-react/types/permissions-level'
import { ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'
import { GotoLineOptions } from '@/features/ide-react/types/goto-line-options'
import { CursorPosition } from '@/features/ide-react/types/cursor-position'

export type IdeEvents = {
  'project:joined': [{ project: Project; permissionsLevel: PermissionsLevel }]

  // TODO: MIGRATION: This doesn't seem to be used. Investigate whether it can be removed
  'document:opened': [doc: ShareJsDoc]

  'document:closed': [doc: ShareJsDoc]
  'doc:changed': [{ doc_id: string }]
  'doc:saved': [{ doc_id: string }]
  'doc:opened': []
  'ide:opAcknowledged': [{ doc_id: string; op: any }]
  'store-doc-position': []
  'editor:gotoOffset': [gotoOffset: number]
  'editor:gotoLine': [options: GotoLineOptions]
  'cursor:editor:update': [position: CursorPosition]
  'outline-toggled': [isOpen: boolean]
  'cursor:editor:syncToPdf': []
  'scroll:editor:update': []
  'comment:start_adding': []
  'references:should-reindex': []

  // TODO: MIGRATION: Create a proper type for entity when migrating the file tree
  'entity:deleted': [entity: Record<string, any>]
}

export type IdeEventEmitter = Emitter<IdeEvents>

export function createIdeEventEmitter(): IdeEventEmitter {
  return new Emitter<IdeEvents>()
}
