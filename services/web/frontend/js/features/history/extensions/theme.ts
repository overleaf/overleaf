import { EditorView } from '@codemirror/view'

const fontFamily = 'Monaco, Menlo, Ubuntu Mono, Consolas, monospace'

export const theme = () =>
  EditorView.theme({
    '&.cm-editor': {
      '--font-size': '12px',
      '--source-font-family': fontFamily,
      '--line-height': 1.6,
    },
    '.cm-content': {
      fontSize: 'var(--font-size)',
      fontFamily: 'var(--source-font-family)',
      lineHeight: 'var(--line-height)',
      color: '#000',
    },
    '.cm-gutters': {
      fontSize: 'var(--font-size)',
      lineHeight: 'var(--line-height)',
    },
    '.cm-tooltip': {
      // Set variables for tooltips, which are outside the editor
      '--font-size': '12px',
      '--source-font-family': fontFamily,
      // NOTE: fontFamily is not set here, as most tooltips use the UI font
      fontSize: 'var(--font-size)',
    },
    '.cm-lineNumbers': {
      fontFamily: 'var(--source-font-family)',
    },
  })
