import { EditorView } from '@codemirror/view'
import { Compartment, TransactionSpec } from '@codemirror/state'
import { FontFamily, LineHeight, userStyles } from '@/shared/utils/styles'

export type Options = {
  fontSize: number
  fontFamily: FontFamily
  lineHeight: LineHeight
}

const optionsThemeConf = new Compartment()

export const theme = (options: Options) => [
  baseTheme,
  optionsThemeConf.of(createThemeFromOptions(options)),
]

const createThemeFromOptions = ({
  fontSize = 12,
  fontFamily = 'monaco',
  lineHeight = 'normal',
}: Options) => {
  // Theme styles that depend on settings
  const styles = userStyles({ fontSize, fontFamily, lineHeight })

  return [
    EditorView.editorAttributes.of({
      style: Object.entries({
        '--font-size': styles.fontSize,
        '--source-font-family': styles.fontFamily,
        '--line-height': styles.lineHeight,
      })
        .map(([key, value]) => `${key}: ${value}`)
        .join(';'),
    }),
    // Set variables for tooltips, which are outside the editor
    // TODO: set these on document.body, or a new container element for the tooltips, without using a style mod
    EditorView.theme({
      '.cm-tooltip': {
        '--font-size': styles.fontSize,
        '--source-font-family': styles.fontFamily,
      },
    }),
  ]
}

const baseTheme = EditorView.theme({
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
  '.cm-lineNumbers': {
    fontFamily: 'var(--source-font-family)',
  },
  '.cm-tooltip': {
    // NOTE: fontFamily is not set here, as most tooltips use the UI font
    fontSize: 'var(--font-size)',
  },
})

export const setOptionsTheme = (options: Options): TransactionSpec => {
  return {
    effects: optionsThemeConf.reconfigure(createThemeFromOptions(options)),
  }
}
