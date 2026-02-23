import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { gotoLine } from '@codemirror/search'

/**
 * A custom extension that provides a keyboard shortcut
 * and panel with UI for jumping to a specific line number.
 */
export const goToLinePanel = () => {
  return [
    Prec.high(
      keymap.of([
        {
          key: 'Mod-Shift-l',
          preventDefault: true,
          run: gotoLine,
        },
      ])
    ),
    gotoLineTheme,
  ]
}

const gotoLineTheme = EditorView.baseTheme({
  '.cm-panel.cm-gotoLine': {
    padding: '10px',
    fontSize: '14px',
    backgroundColor: 'var(--bg-secondary-themed)',
    '& label': {
      margin: 0,
      fontSize: '14px',
      color: 'var(--content-primary-themed)',
      '& .cm-textfield': {
        margin: '0 10px',
        maxWidth: '100px',
        height: '34px',
        padding: '5px 16px',
        fontSize: '14px',
        fontWeight: 'normal',
        color: 'var(--content-primary-themed)',
        backgroundColor: 'var(--bg-primary-themed)',
        border: '1px solid var(--border-primary-themed)',
        backgroundImage: 'none',
        borderRadius: 'var(--border-radius-full)',
        boxShadow: 'inset 0 1px 1px rgb(0 0 0 / 8%)',
        transition:
          'border-color ease-in-out .15s, box-shadow ease-in-out .15s',
        '&:focus-visible': {
          outline: 'none',
          boxShadow:
            'inset 0 1px 1px rgb(0 0 0 / 8%), 0 0 8px rgb(102 175 233 / 60%)',
        },
      },
    },
    '& .cm-button': {
      padding: '4px 16px 5px',
      textTransform: 'capitalize',
      fontSize: '14px',
      userSelect: 'none',
      backgroundImage: 'none',
      backgroundColor: 'var(--bg-secondary-themed)',
      borderRadius: 'var(--border-radius-full)',
      border: '0 solid transparent',
      color: 'var(--content-primary-themed)',
      fontWeight: '600',
      transition: 'background-color ease-in-out .15s',
      '&:hover': {
        backgroundColor: 'var(--bg-tertiary-themed)',
      },
    },
  },
})
