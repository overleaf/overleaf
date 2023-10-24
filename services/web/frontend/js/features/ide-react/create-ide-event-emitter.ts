import { Emitter } from 'strict-event-emitter'
import { Project } from '../../../../types/project'
import { PermissionsLevel } from '@/features/ide-react/types/permissions-level'
import { GotoLineOptions } from '@/features/ide-react/types/goto-line-options'
import { CursorPosition } from '@/features/ide-react/types/cursor-position'

export type IdeEvents = {
  'project:joined': [{ project: Project; permissionsLevel: PermissionsLevel }]

  'editor:gotoOffset': [gotoOffset: number]
  'editor:gotoLine': [options: GotoLineOptions]
  'outline-toggled': [isOpen: boolean]
  'cursor:editor:update': [position: CursorPosition]
  'cursor:editor:syncToPdf': []
  'scroll:editor:update': []
  'comment:start_adding': []
}

export type IdeEventEmitter = Emitter<IdeEvents>

export function createIdeEventEmitter(): IdeEventEmitter {
  return new Emitter<IdeEvents>()
}
