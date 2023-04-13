import { Extension } from '@codemirror/state'
import { indentationMarkers as markers } from '@replit/codemirror-indentation-markers'
import { sourceOnly } from './visual/visual'

export const indentationMarkers = (visual: boolean): Extension =>
  sourceOnly(visual, [
    markers({ hideFirstIndent: true, highlightActiveBlock: false }),
  ])
