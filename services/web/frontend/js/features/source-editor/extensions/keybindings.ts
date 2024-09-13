import { openSearchPanel } from '@codemirror/search'
import {
  Compartment,
  EditorSelection,
  Prec,
  TransactionSpec,
} from '@codemirror/state'
import type { EmacsHandler } from '@replit/codemirror-emacs'
import type { CodeMirror, Vim } from '@replit/codemirror-vim'
import { foldCode, toggleFold, unfoldCode } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import {
  cursorToBeginningOfVisualLine,
  cursorToEndOfVisualLine,
  selectRestOfVisualLine,
  selectToBeginningOfVisualLine,
  selectToEndOfVisualLine,
} from './visual-line-selection'

const hasNonEmptySelection = (cm: CodeMirror): boolean => {
  const selections = cm.getSelections()
  return selections.some(selection => selection.length)
}

type VimCodeMirrorCommands = typeof CodeMirror.commands & {
  save: (cm: CodeMirror) => void
}

let customisedVim = false
const customiseVimOnce = (_Vim: typeof Vim, _CodeMirror: typeof CodeMirror) => {
  if (customisedVim) {
    return
  }
  // Allow copy via Ctrl-C in insert mode
  _Vim.unmap('<C-c>', 'insert')

  _Vim.defineAction('insertModeCtrlC', (cm: CodeMirror) => {
    if (hasNonEmptySelection(cm)) {
      navigator.clipboard.writeText(cm.getSelection())
      cm.setSelection(cm.getCursor(), cm.getCursor())
    } else {
      _Vim.exitInsertMode(cm)
    }
  })

  // Overwrite the moveByCharacters command with a decoration-aware version
  _Vim.defineMotion(
    'moveByCharacters',
    function (
      cm: CodeMirror,
      head: { line: number; ch: number },
      motionArgs: Record<string, unknown>
    ) {
      const { cm6: view } = cm
      const repeat = Math.min(Number(motionArgs.repeat), view.state.doc.length)
      const forward = Boolean(motionArgs.forward)
      // head.line is 0-indexed
      const startLine = view.state.doc.line(head.line + 1)
      let cursor = EditorSelection.cursor(startLine.from + head.ch)
      for (let i = 0; i < repeat; ++i) {
        cursor = view.moveByChar(cursor, forward)
      }
      const finishLine = view.state.doc.lineAt(cursor.head)
      return new _CodeMirror.Pos(
        finishLine.number - 1,
        cursor.head - finishLine.from
      )
    }
  )

  _Vim.mapCommand('<C-c>', 'action', 'insertModeCtrlC', undefined, {
    context: 'insert',
  })

  // Code folding commands
  _Vim.defineAction('toggleFold', function (cm: CodeMirror) {
    toggleFold(cm.cm6)
  })
  _Vim.mapCommand('za', 'action', 'toggleFold')

  _Vim.defineAction('foldCode', function (cm: CodeMirror) {
    foldCode(cm.cm6)
  })
  _Vim.mapCommand('zc', 'action', 'foldCode')

  _Vim.defineAction('unfoldCode', function (cm: CodeMirror) {
    unfoldCode(cm.cm6)
  })

  // disable tab and shift-tab keys in command (normal) and visual modes
  // using "undefined" params because mapCommand signature is:
  // mapCommand(keys, type, name, args, extra)
  _Vim.mapCommand('<Tab>', undefined, undefined, undefined, {
    context: 'normal',
  })
  _Vim.mapCommand('<Tab>', undefined, undefined, undefined, {
    context: 'visual',
  })
  _Vim.mapCommand('<S-Tab>', undefined, undefined, undefined, {
    context: 'normal',
  })
  _Vim.mapCommand('<S-Tab>', undefined, undefined, undefined, {
    context: 'visual',
  })

  // Make the Vim 'write' command start a compile
  ;(_CodeMirror.commands as VimCodeMirrorCommands).save = () => {
    window.dispatchEvent(new Event('pdf:recompile'))
  }
  customisedVim = true
}

// Used to ensure that only one listener is active
let emacsSearchCloseListener: (() => void) | undefined

let customisedEmacs = false
const customiseEmacsOnce = (_EmacsHandler: typeof EmacsHandler) => {
  if (customisedEmacs) {
    return
  }
  customisedEmacs = true

  const jumpToLastMark = (handler: EmacsHandler) => {
    const mark = handler.popEmacsMark()
    if (!mark || !mark.length) {
      return
    }
    let selection = null
    if (mark.length >= 2) {
      selection = EditorSelection.range(mark[0], mark[1])
    } else {
      selection = EditorSelection.cursor(mark[0])
    }
    handler.view.dispatch({ selection, scrollIntoView: true })
  }

  _EmacsHandler.addCommands({
    openSearch(handler: EmacsHandler) {
      const mark = handler.view.state.selection.main
      handler.pushEmacsMark([mark.anchor, mark.head])
      openSearchPanel(handler.view)
      if (emacsSearchCloseListener) {
        document.removeEventListener(
          'cm:emacs-close-search-panel',
          emacsSearchCloseListener
        )
      }
      emacsSearchCloseListener = () => {
        jumpToLastMark(handler)
      }
      document.addEventListener(
        'cm:emacs-close-search-panel',
        emacsSearchCloseListener
      )
    },
    save() {
      window.dispatchEvent(new Event('pdf:recompile'))
    },
  })
  _EmacsHandler.bindKey('C-s', 'openSearch')
  _EmacsHandler.bindKey('C-r', 'openSearch')
  _EmacsHandler.bindKey('C-x C-s', 'save')
  _EmacsHandler.bindKey('C-a', {
    command: 'goOrSelect',
    args: [cursorToBeginningOfVisualLine, selectToBeginningOfVisualLine],
  })
  _EmacsHandler.bindKey('C-e', {
    command: 'goOrSelect',
    args: [cursorToEndOfVisualLine, selectToEndOfVisualLine],
  })
  _EmacsHandler.bindKey('C-k', {
    command: 'killLine',
    args: selectRestOfVisualLine,
  })
}

const options = [
  {
    name: 'default',
    load: async () => {
      // TODO: load default keybindings?
      return []
    },
  },
  {
    name: 'vim',
    load: () =>
      import(
        /* webpackChunkName: "codemirror-vim" */ '@replit/codemirror-vim'
      ).then(m => {
        customiseVimOnce(m.Vim, m.CodeMirror)
        return m.vim()
      }),
  },
  {
    name: 'emacs',
    load: () =>
      import(
        /* webpackChunkName: "codemirror-emacs" */ '@replit/codemirror-emacs'
      ).then(m => {
        customiseEmacsOnce(m.EmacsHandler)
        return [
          m.emacs(),
          EditorView.domEventHandlers({
            keydown(event) {
              if (event.ctrlKey && event.key === 's') {
                event.stopPropagation()
              }
            },
          }),
        ]
      }),
  },
]

const keybindingsConf = new Compartment()

/**
 * Third-party extensions providing Emacs and Vim keybindings,
 * implemented as wrappers around the CodeMirror 5 interface,
 * with some customisation (particularly related to search).
 */
export const keybindings = () => {
  return keybindingsConf.of(Prec.highest([]))
}

export const setKeybindings = async (
  selectedKeybindings = 'default'
): Promise<TransactionSpec> => {
  if (selectedKeybindings === 'none') {
    selectedKeybindings = 'default'
  }

  const selectedOption = options.find(
    option => option.name === selectedKeybindings
  )

  if (!selectedOption) {
    throw new Error(`No key bindings found with name ${selectedKeybindings}`)
  }

  const support = await selectedOption.load()

  return {
    // NOTE: use Prec.highest as this keybinding must be above the default keymap(s)
    effects: keybindingsConf.reconfigure(Prec.highest(support)),
  }
}
