import {
  EditorView,
  highlightSpecialChars,
  rectangularSelection,
  tooltips,
  crosshairCursor,
  dropCursor,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { foldGutter, indentOnInput } from '@codemirror/language'
import { history } from '@codemirror/commands'
import { language } from './language'
import { lineWrappingIndentation } from './line-wrapping-indentation'
import { theme } from './theme'
import { realtime } from './realtime'
import { cursorPosition } from './cursor-position'
import { scrollPosition } from './scroll-position'
import { annotations } from './annotations'
import { cursorHighlights } from './cursor-highlights'
import { autoComplete } from './auto-complete'
import { editable } from './editable'
import { autoPair } from './auto-pair'
import { phrases } from './phrases'
import { spelling } from './spelling'
import { symbolPalette } from './symbol-palette'
import { trackChanges } from './track-changes'
import { search } from './search'
import { filterCharacters } from './filter-characters'
import { keybindings } from './keybindings'
import { bracketMatching, bracketSelection } from './bracket-matching'
import { verticalOverflow } from './vertical-overflow'
import { exceptionLogger } from './exception-logger'
import { thirdPartyExtensions } from './third-party-extensions'
import { lineNumbers } from './line-numbers'
import { highlightActiveLine } from './highlight-active-line'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { emptyLineFiller } from './empty-line-filler'
import { goToLinePanel } from './go-to-line'
import { drawSelection } from './draw-selection'
import { sourceOnly, visual } from './visual/visual'
import { inlineBackground } from './inline-background'
import { indentationMarkers } from './indentation-markers'
import { codemirrorDevTools } from '../languages/latex/codemirror-dev-tools'
import { keymaps } from './keymaps'
import { shortcuts } from './shortcuts'
import { effectListeners } from './effect-listeners'

const moduleExtensions: Array<() => Extension> = importOverleafModules(
  'sourceEditorExtensions'
).map((item: { import: { extension: Extension } }) => item.import.extension)

export const createExtensions = (options: Record<string, any>): Extension[] => [
  lineNumbers(),
  sourceOnly(
    false,
    highlightSpecialChars({
      addSpecialChars: new RegExp(
        // non standard space characters (https://jkorpela.fi/chars/spaces.html)
        '[\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u200B\u202F\u205F\u3000\uFEFF]',
        /x/.unicode != null ? 'gu' : 'g'
      ),
    })
  ),
  history({ newGroupDelay: 250 }),
  foldGutter({
    openText: '▾',
    closedText: '▸',
  }),
  drawSelection(),
  EditorState.allowMultipleSelections.of(true),
  EditorView.lineWrapping,
  indentOnInput(),
  lineWrappingIndentation(options.visual.visual),
  indentationMarkers(options.visual.visual),
  bracketMatching(),
  bracketSelection(),
  rectangularSelection(),
  crosshairCursor(),
  dropCursor(),
  tooltips({
    parent: document.body,
  }),
  keymaps,
  goToLinePanel(),
  filterCharacters(),

  // `autoComplete` needs to be before `keybindings` so that arrow key handling
  // in the autocomplete pop-up takes precedence over Vim/Emacs key bindings
  autoComplete(options.settings),

  // `keybindings` needs to be before `language` so that Vim/Emacs bindings take
  // precedence over language-specific keyboard shortcuts
  keybindings(),

  annotations(), // NOTE: must be before `language`
  language(options.currentDoc, options.metadata, options.settings),
  theme(options.theme),
  realtime(options.currentDoc, options.handleError),
  cursorPosition(options.currentDoc),
  scrollPosition(options.currentDoc),
  cursorHighlights(),
  autoPair(options.settings),
  editable(),
  search(),
  phrases(options.phrases),
  spelling(options.spelling),
  shortcuts,
  symbolPalette(),
  emptyLineFiller(), // NOTE: must be before `trackChanges`
  trackChanges(options.currentDoc, options.changeManager),
  visual(options.currentDoc, options.visual),
  verticalOverflow(),
  highlightActiveLine(options.visual.visual),
  highlightActiveLineGutter(),
  inlineBackground(options.visual.visual),
  codemirrorDevTools(),
  exceptionLogger(),
  moduleExtensions.map(extension => extension()),
  thirdPartyExtensions(),
  effectListeners(),
]
