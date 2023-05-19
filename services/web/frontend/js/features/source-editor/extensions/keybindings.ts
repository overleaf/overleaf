import { openSearchPanel } from '@codemirror/search'
import {
  Compartment,
  EditorSelection,
  Prec,
  TransactionSpec,
} from '@codemirror/state'
import { EmacsHandler } from '@replit/codemirror-emacs'
import { CodeMirror } from '@replit/codemirror-vim'
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

let customisedVim = false
const customiseVimOnce = (Vim: any, CodeMirror: any) => {
  if (customisedVim) {
    return
  }
  // Allow copy via Ctrl-C in insert mode
  Vim.unmap('<C-c>', 'insert')

  Vim.defineAction(
    'insertModeCtrlC',
    (cm: CodeMirror, actionArgs: object, state: any) => {
      if (hasNonEmptySelection(cm)) {
        navigator.clipboard.writeText(cm.getSelection())
        cm.setSelection(cm.getCursor(), cm.getCursor())
      } else {
        Vim.exitInsertMode(cm)
      }
    }
  )

  // Overwrite the moveByCharacters command with a decoration-aware version
  Vim.defineMotion(
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
      return new CodeMirror.Pos(
        finishLine.number - 1,
        cursor.head - finishLine.from
      )
    }
  )

  Vim.mapCommand('<C-c>', 'action', 'insertModeCtrlC', undefined, {
    context: 'insert',
  })

  // Code folding commands
  Vim.defineAction('toggleFold', function (cm: CodeMirror) {
    toggleFold(cm.cm6)
  })
  Vim.mapCommand('za', 'action', 'toggleFold')

  Vim.defineAction('foldCode', function (cm: CodeMirror) {
    foldCode(cm.cm6)
  })
  Vim.mapCommand('zc', 'action', 'foldCode')

  Vim.defineAction('unfoldCode', function (cm: CodeMirror) {
    unfoldCode(cm.cm6)
  })

  // disable tab and shift-tab keys in command (normal) and visual modes
  // using "undefined" params because mapCommand signature is:
  // mapCommand(keys, type, name, args, extra)
  Vim.mapCommand('<Tab>', undefined, undefined, undefined, {
    context: 'normal',
  })
  Vim.mapCommand('<Tab>', undefined, undefined, undefined, {
    context: 'visual',
  })
  Vim.mapCommand('<S-Tab>', undefined, undefined, undefined, {
    context: 'normal',
  })
  Vim.mapCommand('<S-Tab>', undefined, undefined, undefined, {
    context: 'visual',
  })

  // Make the Vim 'write' command start a compile
  CodeMirror.commands.save = () => {
    window.dispatchEvent(new Event('pdf:recompile'))
  }
  customisedVim = true
}

// Used to ensure that only one listener is active
let emacsSearchCloseListener: (() => void) | undefined

let customisedEmacs = false
const customiseEmacsOnce = () => {
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

  EmacsHandler.addCommands({
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
  EmacsHandler.bindKey('C-s', 'openSearch')
  EmacsHandler.bindKey('C-r', 'openSearch')
  EmacsHandler.bindKey('C-x C-s', 'save')
  EmacsHandler.bindKey('C-a', {
    command: 'goOrSelect',
    args: [cursorToBeginningOfVisualLine, selectToBeginningOfVisualLine],
  })
  EmacsHandler.bindKey('C-e', {
    command: 'goOrSelect',
    args: [cursorToEndOfVisualLine, selectToEndOfVisualLine],
  })
  EmacsHandler.bindKey('C-k', {
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
      import('@replit/codemirror-vim').then(m => {
        customiseVimOnce(m.Vim, m.CodeMirror)
        return m.vim()
      }),
  },
  {
    name: 'emacs',
    load: () =>
      import('@replit/codemirror-emacs').then(m => {
        customiseEmacsOnce()
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
