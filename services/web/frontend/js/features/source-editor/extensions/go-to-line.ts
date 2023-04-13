import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { gotoLine } from '@codemirror/search'

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
    EditorView.baseTheme({
      '.cm-panel.cm-gotoLine': {
        padding: '10px',
        fontSize: '14px',
        '& label': {
          margin: 0,
          fontSize: '14px',
          '& .cm-textfield': {
            margin: '0 10px',
            maxWidth: '100px',
            height: '34px',
            padding: '5px 16px',
            fontSize: '14px',
            fontWeight: 'normal',
            lineHeight: 'var(--line-height-base)',
            color: 'var(--input-color)',
            backgroundColor: '#fff',
            backgroundImage: 'none',
            borderRadius: 'var(--input-border-radius)',
            boxShadow: 'inset 0 1px 1px rgb(0 0 0 / 8%)',
            transition:
              'border-color ease-in-out .15s, box-shadow ease-in-out .15s',
            '&:focus-visible': {
              outline: 'none',
            },
            '&:focus': {
              borderColor: 'var(--input-border-focus)',
            },
          },
        },
        '& .cm-button': {
          padding: '4px 16px 5px',
          textTransform: 'capitalize',
          fontSize: '14px',
          lineHeight: 'var(--line-height-base)',
          userSelect: 'none',
          backgroundImage: 'none',
          backgroundColor: 'var(--btn-default-bg)',
          borderRadius: 'var(--btn-border-radius-base)',
          border: '0 solid transparent',
          color: '#fff',
        },
      },
    }),
  ]
}
