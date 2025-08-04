import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export class ThemeCache {
  private cache: Map<string, Extension> = new Map()

  public get: typeof EditorView.theme = (styleMod, options) => {
    const key = JSON.stringify({ styleMod, options })
    const existing = this.cache.get(key)
    if (existing) {
      return existing
    }
    // eslint-disable-next-line @overleaf/no-generated-editor-themes
    const theme = EditorView.theme(styleMod, options)
    this.cache.set(key, theme)
    return theme
  }
}
