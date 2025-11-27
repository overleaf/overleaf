import { EditorView } from '@codemirror/view'
import { Annotation, Compartment, TransactionSpec } from '@codemirror/state'
import { syntaxHighlighting } from '@codemirror/language'
import { classHighlighter } from './class-highlighter'
import classNames from 'classnames'
import { FontFamily, LineHeight, userStyles } from '@/shared/utils/styles'
import { ActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'
import { ThemeCache } from '../utils/theme-cache'
import getMeta from '@/utils/meta'

const optionsThemeConf = new Compartment()
const selectedThemeConf = new Compartment()
export const themeOptionsChange = Annotation.define<boolean>()

type Options = {
  fontSize: number
  fontFamily: FontFamily
  lineHeight: LineHeight
  activeOverallTheme: ActiveOverallTheme
}

export const theme = (options: Options) => [
  baseTheme,
  staticTheme,
  /**
   * Syntax highlighting, using a highlighter which maps tags to class names.
   */
  syntaxHighlighting(classHighlighter),
  optionsThemeConf.of(createThemeFromOptions(options)),
  selectedThemeConf.of([]),
]

export const setOptionsTheme = (options: Options): TransactionSpec => {
  return {
    effects: optionsThemeConf.reconfigure(createThemeFromOptions(options)),
    annotations: themeOptionsChange.of(true),
  }
}

export const setEditorTheme = async (
  editorTheme: string
): Promise<TransactionSpec> => {
  const theme = await loadSelectedTheme(editorTheme)

  return {
    effects: selectedThemeConf.reconfigure(theme),
  }
}

const svgUrl = (content: string) =>
  `url('data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${content}</svg>`
  )}')`

const tooltipThemeCache = new ThemeCache()

const createThemeFromOptions = ({
  fontSize = 12,
  fontFamily = 'monaco',
  lineHeight = 'normal',
  activeOverallTheme = 'dark',
}: Options) => {
  // Theme styles that depend on settings.
  const styles = userStyles({ fontSize, fontFamily, lineHeight })

  return [
    EditorView.editorAttributes.of({
      class: classNames(
        activeOverallTheme === 'dark'
          ? 'overall-theme-dark'
          : 'overall-theme-light'
      ),
      style: Object.entries({
        '--font-size': styles.fontSize,
        '--source-font-family': styles.fontFamily,
        '--line-height': styles.lineHeight,
      })
        .map(([key, value]) => `${key}: ${value}`)
        .join(';'),
    }),
    tooltipThemeCache.get({
      '.cm-tooltip': {
        '--font-size': styles.fontSize,
        '--source-font-family': styles.fontFamily,
        '--line-height': styles.lineHeight,
      },
    }),
  ]
}

/**
 * Base styles that can have &dark and &light variants
 */
const baseTheme = EditorView.baseTheme({
  '&light.cm-editor': {
    colorScheme: 'light',
  },
  '&dark.cm-editor': {
    colorScheme: 'dark',
  },
  '.cm-content': {
    fontSize: 'var(--font-size)',
    fontFamily: 'var(--source-font-family)',
    lineHeight: 'var(--line-height)',
  },
  '.cm-cursor-primary': {
    fontSize: 'var(--font-size)',
    fontFamily: 'var(--source-font-family)',
    lineHeight: 'var(--line-height)',
  },
  '.cm-gutters': {
    fontSize: 'var(--font-size)',
    lineHeight: 'var(--line-height)',
  },
  '.cm-tooltip': {
    // NOTE: fontFamily is not set here, as most tooltips use the UI font
    fontSize: 'var(--font-size)',
  },
  '.cm-panel': {
    fontSize: 'var(--font-size)',
  },
  '.cm-foldGutter .cm-gutterElement > span': {
    height: 'calc(var(--font-size) * var(--line-height))',
  },
  '.cm-lineNumbers': {
    fontFamily: 'var(--source-font-family)',
  },
  // double the specificity to override the underline squiggle
  '.cm-lintRange.cm-lintRange': {
    backgroundImage: 'none',
  },
  // use a background color for lint error ranges
  '.cm-lintRange-error': {
    padding: 'var(--half-leading, 0) 0',
    background: 'rgba(255, 0, 0, 0.2)',
    // avoid highlighting nested error ranges
    '& .cm-lintRange-error': {
      background: 'none',
    },
  },
  '.cm-specialChar': {
    color: 'red',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  '.cm-widgetBuffer': {
    height: '1.3em',
  },
  '.cm-snippetFieldPosition': {
    display: 'inline-block',
    height: '1.3em',
  },
  // style the gutter fold button on hover
  '&dark .cm-foldGutter .cm-gutterElement > span:hover': {
    boxShadow: '0 1px 1px rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '&light .cm-foldGutter .cm-gutterElement > span:hover': {
    borderColor: 'rgba(0, 0, 0, 0.3)',
    boxShadow: '0 1px 1px rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  '.cm-diagnosticSource': {
    display: 'none',
  },
  '.ol-cm-diagnostic-actions': {
    marginTop: '4px',
  },
  '.cm-diagnostic:last-of-type .ol-cm-diagnostic-actions': {
    marginBottom: '4px',
  },
  '.cm-vim-panel input': {
    color: 'inherit',
  },
})

/**
 * Theme styles that don't depend on settings.
 */
// TODO: move some/all of these into baseTheme?
const staticTheme = EditorView.theme({
  // make the editor fill the available height
  '&': {
    height: '100%',
    textRendering: 'optimizeSpeed',
    fontVariantNumeric: 'slashed-zero',
  },
  // remove the outline from the focused editor
  '&.cm-editor.cm-focused:not(:focus-visible)': {
    outline: 'none',
  },
  // override default styles for the search panel
  '.cm-panel.cm-search label': {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 'normal',
  },
  '.cm-selectionLayer': {
    zIndex: -10,
  },
  // remove the right-hand border from the gutter
  // ensure the gutter doesn't shrink
  '.cm-gutters': {
    borderRight: 'none',
    flexShrink: 0,
  },
  // style the gutter fold button
  // TODO: add a class to this element for easier theming
  '.cm-foldGutter .cm-gutterElement > span': {
    border: '1px solid transparent',
    borderRadius: '3px',
    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'center',
    color: 'rgba(109, 109, 109, 0.7)',
  },
  // reduce the padding around line numbers
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0',
    userSelect: 'none',
  },
  // make cursor visible with reduced opacity when the editor is not focused
  '&:not(.cm-focused) > .cm-scroller > .cm-cursorLayer .cm-cursor': {
    display: 'block',
    opacity: 0.2,
  },
  // make the cursor wider, and use the themed color
  '.cm-cursor, .cm-dropCursor': {
    borderWidth: '2px',
    marginLeft: '-1px', // half the border width
    borderLeftColor: 'inherit',
  },
  // remove border from hover tooltips (e.g. cursor highlights)
  '.cm-tooltip-hover': {
    border: 'none',
  },
  // use the same style as Ace for snippet fields
  '.cm-snippetField': {
    background: 'rgba(194, 193, 208, 0.09)',
    border: '1px dotted rgba(211, 208, 235, 0.62)',
  },
  // style the fold placeholder
  '.cm-foldPlaceholder': {
    boxSizing: 'border-box',
    display: 'inline-block',
    height: '11px',
    width: '1.8em',
    marginTop: '-2px',
    verticalAlign: 'middle',
    backgroundImage:
      'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAJCAYAAADU6McMAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAJpJREFUeNpi/P//PwOlgAXGYGRklAVSokD8GmjwY1wasKljQpYACtpCFeADcHVQfQyMQAwzwAZI3wJKvCLkfKBaMSClBlR7BOQikCFGQEErIH0VqkabiGCAqwUadAzZJRxQr/0gwiXIal8zQQPnNVTgJ1TdawL0T5gBIP1MUJNhBv2HKoQHHjqNrA4WO4zY0glyNKLT2KIfIMAAQsdgGiXvgnYAAAAASUVORK5CYII="),url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAA3CAYAAADNNiA5AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAACJJREFUeNpi+P//fxgTAwPDBxDxD078RSX+YeEyDFMCIMAAI3INmXiwf2YAAAAASUVORK5CYII=")',
    backgroundRepeat: 'no-repeat, repeat-x',
    backgroundPosition: 'center center, top left',
    color: 'transparent',
    border: '1px solid black',
    borderRadius: '2px',
  },
  // align the lint icons with the line numbers
  '.cm-gutter-lint .cm-gutterElement': {
    padding: '0.3em',
  },
  // reset the default style for the lint gutter error marker, which uses :before
  '.cm-lint-marker-error:before': {
    content: 'normal',
  },
  // set a new icon for the lint gutter error marker
  '.cm-lint-marker-error': {
    content: svgUrl(
      `<circle cx="20" cy="20" r="15" fill="#f87" stroke="#f43" stroke-width="6"/>`
    ),
  },
  // set a new icon for the lint gutter warning marker
  '.cm-lint-marker-warning': {
    content: svgUrl(
      `<path fill="#FCC483" stroke="#DE8014" stroke-width="6" stroke-linejoin="round" d="M20 6L37 35L3 35Z"/>`
    ),
  },
})

const themeCache = new Map<string, any>()

const loadSelectedTheme = async (editorTheme: string) => {
  if (!editorTheme) {
    editorTheme = 'textmate' // use the default theme if unset
  }

  if (!themeCache.has(editorTheme)) {
    const themes = getMeta('ol-editorThemes') || []
    const legacyThemes = getMeta('ol-legacyEditorThemes') || []
    const themeExists =
      themes.some(theme => theme.name === editorTheme) ||
      legacyThemes.some(theme => theme.name === editorTheme)
    if (!themeExists) {
      editorTheme = 'textmate' // fallback to default if the theme is not found
    }

    const { theme, highlightStyle, dark } = await import(
      /* webpackChunkName: "cm6-theme" */ `../themes/cm6/${editorTheme}.json`
    )

    // We store these in a cache, so we'll reuse after the first load
    const extension = [
      // eslint-disable-next-line @overleaf/no-generated-editor-themes
      EditorView.theme(theme, { dark }),
      // eslint-disable-next-line @overleaf/no-generated-editor-themes
      EditorView.theme(highlightStyle, { dark }),
    ]

    themeCache.set(editorTheme, extension)
  }

  return themeCache.get(editorTheme)
}
