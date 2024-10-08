import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  moveCompletionSelection,
  startCompletion,
  Completion,
} from '@codemirror/autocomplete'
import { EditorView, keymap } from '@codemirror/view'
import {
  Compartment,
  Extension,
  Prec,
  TransactionSpec,
} from '@codemirror/state'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'

const moduleExtensions: Array<(options: Record<string, any>) => Extension> =
  importOverleafModules('autoCompleteExtensions').map(
    (item: { import: { extension: Extension } }) => item.import.extension
  )

const autoCompleteConf = new Compartment()

type AutoCompleteOptions = {
  enabled: boolean
} & Record<string, any>

export const autoComplete = ({ enabled, ...rest }: AutoCompleteOptions) =>
  autoCompleteConf.of(createAutoComplete({ enabled, ...rest }))

export const setAutoComplete = ({
  enabled,
  ...rest
}: AutoCompleteOptions): TransactionSpec => {
  return {
    effects: autoCompleteConf.reconfigure(
      createAutoComplete({ enabled, ...rest })
    ),
  }
}

const createAutoComplete = ({ enabled, ...rest }: AutoCompleteOptions) => {
  if (!enabled) {
    return []
  }

  return [
    [
      autocompleteTheme,
      /**
       * A built-in extension which provides the autocomplete feature,
       * configured with a custom render function and
       * a zero interaction delay (so that keypresses are handled after the autocomplete is opened).
       */
      autocompletion({
        icons: false,
        defaultKeymap: false,
        addToOptions: [
          // display the completion "type" at the end of the suggestion
          {
            render: completion => {
              const span = document.createElement('span')
              span.classList.add('ol-cm-completionType')
              if (completion.type) {
                span.textContent = completion.type
              }
              return span
            },
            position: 400,
          },
        ],
        optionClass: (completion: Completion) => {
          return `ol-cm-completion-${completion.type}`
        },
        interactionDelay: 0,
      }),
      /**
       * A keymap which adds Tab for accepting a completion and Ctrl-Space for opening autocomplete.
       */
      Prec.highest(
        keymap.of([
          { key: 'Escape', run: closeCompletion },
          { key: 'ArrowDown', run: moveCompletionSelection(true) },
          { key: 'ArrowUp', run: moveCompletionSelection(false) },
          { key: 'PageDown', run: moveCompletionSelection(true, 'page') },
          { key: 'PageUp', run: moveCompletionSelection(false, 'page') },
          { key: 'Enter', run: acceptCompletion },
          { key: 'Tab', run: acceptCompletion },
        ])
      ),
      /**
       * A keymap which positions Ctrl-Space and Alt-Space below the corresponding bindings for advanced reference search.
       */
      Prec.high(
        keymap.of([
          { key: 'Ctrl-Space', run: startCompletion },
          { key: 'Alt-Space', run: startCompletion },
        ])
      ),
    ],
    moduleExtensions.map(extension => extension({ ...rest })),
  ]
}

const AUTOCOMPLETE_LINE_HEIGHT = 1.4
/**
 * Styles for the autocomplete menu
 */
const autocompleteTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-tooltip-autocomplete': {
    // shift the tooltip, so the completion aligns with the text
    marginLeft: '-4px',
  },
  '&light .cm-tooltip.cm-tooltip-autocomplete, &light .cm-tooltip.cm-completionInfo':
    {
      border: '1px lightgray solid',
      background: '#fefefe',
      color: '#111',
      boxShadow: '2px 3px 5px rgb(0 0 0 / 20%)',
    },
  '&dark .cm-tooltip.cm-tooltip-autocomplete, &dark .cm-tooltip.cm-completionInfo':
    {
      border: '1px #484747 solid',
      boxShadow: '2px 3px 5px rgba(0, 0, 0, 0.51)',
      background: '#25282c',
      color: '#c1c1c1',
    },

  // match editor font family and font size, so the completion aligns with the text
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--source-font-family)',
    fontSize: 'var(--font-size)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete li[role="option"]': {
    display: 'flex',
    justifyContent: 'space-between',
    lineHeight: AUTOCOMPLETE_LINE_HEIGHT, // increase the line height from default 1.2, for a larger target area
    outline: '1px solid transparent',
  },
  '.cm-tooltip .cm-completionDetail': {
    flex: '1 0 auto',
    fontSize: 'calc(var(--font-size) * 1.4)',
    lineHeight: `calc(var(--font-size) * ${AUTOCOMPLETE_LINE_HEIGHT})`,
    overflow: 'hidden',
    // By default CodeMirror styles the details as italic
    fontStyle: 'normal !important',
    // We use this element for the symbol palette, so change the font to the
    // symbol palette font
    fontFamily: "'Stix Two Math', serif",
  },
  '&light .cm-tooltip.cm-tooltip-autocomplete li[role="option"]:hover': {
    outlineColor: '#abbffe',
    backgroundColor: 'rgba(233, 233, 253, 0.4)',
  },
  '&dark .cm-tooltip.cm-tooltip-autocomplete li[role="option"]:hover': {
    outlineColor: 'rgba(109, 150, 13, 0.8)',
    backgroundColor: 'rgba(58, 103, 78, 0.62)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': {
    color: 'inherit',
  },
  '&light .cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: '#cad6fa',
  },
  '&dark .cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: '#3a674e',
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none', // remove default underline,
  },
  '&light .cm-completionMatchedText': {
    color: '#2d69c7',
  },
  '&dark .cm-completionMatchedText': {
    color: '#93ca12',
  },
  '.ol-cm-completionType': {
    paddingLeft: '1em',
    paddingRight: 0,
    width: 'auto',
    fontSize: '90%',
    fontFamily: 'var(--source-font-family)',
    opacity: '0.5',
  },
  '.cm-completionInfo .ol-cm-symbolCompletionInfo': {
    margin: 0,
    whiteSpace: 'normal',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  '.cm-completionInfo .ol-cm-symbolCharacter': {
    fontSize: '32px',
  },
})
