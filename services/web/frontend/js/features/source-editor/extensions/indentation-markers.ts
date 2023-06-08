import { Extension } from '@codemirror/state'
import { indentationMarkers as markers } from '@replit/codemirror-indentation-markers'
import { sourceOnly } from './visual/visual'

/**
 * A third-party extension which adds markers to show the indentation level.
 * Configured to omit markers in the first column and to keep the same style for markers in the active block.
 */
export const indentationMarkers = (visual: boolean): Extension =>
  sourceOnly(visual, [
    markers({ hideFirstIndent: true, highlightActiveBlock: false }),
  ])
