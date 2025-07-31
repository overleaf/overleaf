export type OverallTheme = '' | 'light-' | 'system'

export const fontFamilies = {
  monaco: ['Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'monospace'],
  lucida: ['Lucida Console', 'Source Code Pro', 'monospace'],
  opendyslexicmono: ['OpenDyslexic Mono', 'monospace'],
}

export type FontFamily = keyof typeof fontFamilies

export const lineHeights = {
  compact: 1.33,
  normal: 1.6,
  wide: 2,
}

export type LineHeight = keyof typeof lineHeights

type Options = {
  fontFamily: FontFamily
  fontSize: number
  lineHeight: LineHeight
}

export const userStyles = ({ fontFamily, fontSize, lineHeight }: Options) => ({
  fontFamily: fontFamilies[fontFamily]?.join(','),
  fontSize: `${fontSize}px`,
  lineHeight: lineHeights[lineHeight],
})
