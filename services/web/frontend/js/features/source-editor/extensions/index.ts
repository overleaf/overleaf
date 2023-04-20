import {
  EditorView,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
  tooltips,
  crosshairCursor,
  dropCursor,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { foldGutter, indentOnInput } from '@codemirror/language'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { lintKeymap } from '@codemirror/lint'
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
import { shortcuts } from './shortcuts'
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
import { parserWatcher } from './wait-for-parser'
import { drawSelection } from './draw-selection'
import { visual } from './visual/visual'
import { scrollOneLine } from './scroll-one-line'
import { foldingKeymap } from './folding-keymap'
import { inlineBackground } from './inline-background'
import { fontLoad } from './font-load'
import { indentationMarkers } from './indentation-markers'
import { codemirrorDevTools } from '../languages/latex/codemirror-dev-tools'

const ignoredDefaultKeybindings = new Set([
  // NOTE: disable "Mod-Enter" as it's used for "Compile"
  'Mod-Enter',
  // Disable Alt+Arrow as we have special behaviour on Windows / Linux
  'Alt-ArrowLeft',
  'Alt-ArrowRight',
  // This keybinding causes issues on some keyboard layouts where \ is entered
  // using AltGr. Windows treats Ctrl-Alt as AltGr, so trying to insert a \
  // with Ctrl-Alt would trigger this keybinding, rather than inserting a \
  'Mod-Alt-\\',
])

const ignoredDefaultMacKeybindings = new Set([
  // We replace these with our custom visual-line versions
  'Mod-Backspace',
  'Mod-Delete',
])

const moduleExtensions: Array<() => Extension> = importOverleafModules(
  'sourceEditorExtensions'
).map((item: { import: { extension: Extension } }) => item.import.extension)

export const createExtensions = (options: Record<string, any>): Extension[] => [
  lineNumbers(),
  highlightSpecialChars(),
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
  keymap.of([
    ...defaultKeymap.filter(
      // We only filter on keys, so if the keybinding doesn't have a key,
      // allow it
      item => {
        if (item.key && ignoredDefaultKeybindings.has(item.key)) {
          return false
        }
        if (item.mac && ignoredDefaultMacKeybindings.has(item.mac)) {
          return false
        }
        return true
      }
    ),
    ...historyKeymap,
    ...lintKeymap,
  ]),
  foldingKeymap(),
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
  parserWatcher(),
  spelling(options.spelling),
  shortcuts(),
  symbolPalette(),
  emptyLineFiller(), // NOTE: must be before `trackChanges`
  trackChanges(options.currentDoc, options.changeManager),
  visual(options.currentDoc, options.visual),
  verticalOverflow(),
  highlightActiveLine(options.visual.visual),
  highlightActiveLineGutter(),
  scrollOneLine(),
  fontLoad(),
  inlineBackground(options.visual.visual),
  codemirrorDevTools(),
  exceptionLogger(),
  moduleExtensions.map(extension => extension()),
  thirdPartyExtensions(),
]
