import { EditorView } from '@codemirror/view'
import { Compartment, TransactionSpec } from '@codemirror/state'

export type FontFamily = 'monaco' | 'lucida' | 'opendyslexicmono'
export type LineHeight = 'compact' | 'normal' | 'wide'

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

export const lineHeights: Record<LineHeight, number> = {
  compact: 1.33,
  normal: 1.6,
  wide: 2,
}

const fontFamilies: Record<FontFamily, string[]> = {
  monaco: ['Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'monospace'],
  lucida: ['Lucida Console', 'Source Code Pro', 'monospace'],
  opendyslexicmono: ['OpenDyslexic Mono', 'monospace'],
}

const createThemeFromOptions = ({
  fontSize = 12,
  fontFamily = 'monaco',
  lineHeight = 'normal',
}: Options) => {
  // Theme styles that depend on settings
  const fontFamilyValue = fontFamilies[fontFamily]?.join(', ')
  return [
    EditorView.editorAttributes.of({
      style: Object.entries({
        '--font-size': `${fontSize}px`,
        '--source-font-family': fontFamilyValue,
        '--line-height': lineHeights[lineHeight],
      })
        .map(([key, value]) => `${key}: ${value}`)
        .join(';'),
    }),
    // Set variables for tooltips, which are outside the editor
    // TODO: set these on document.body, or a new container element for the tooltips, without using a style mod
    EditorView.theme({
      '.cm-tooltip': {
        '--font-size': `${fontSize}px`,
        '--source-font-family': fontFamilyValue,
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
