import { ProjectionItem } from '@/features/source-editor/utils/tree-operations/projection'
import { BibtexEntry } from '@shared/bibtex/bibtex-entry.mts'

/**
 * A BibtexEntry placed in a CodeMirror document. The `entry` reference is
 * preserved across pure position shifts so identity-sensitive consumers
 * (React.memo, MiniSearch indexes) can skip work when only positions changed.
 *
 * `from`/`to`/`line`/`toLine` come from `ProjectionItem` and are kept in sync
 * by the projection module on every transaction.
 */
export class PositionedBibtexEntry extends ProjectionItem {
  readonly entry: BibtexEntry = new BibtexEntry()
}
