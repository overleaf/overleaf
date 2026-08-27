declare module 'tui-image-editor' {
  interface ImageEditorOptions {
    includeUI?: {
      loadImage?: {
        path: string
        name: string
      }
      theme?: Record<string, string>
      menu?: string[]
      initMenu?: string
      uiSize?: {
        width: string
        height: string
      }
      menuBarPosition?: string
    }
    cssMaxWidth?: number
    cssMaxHeight?: number
    usageStatistics?: boolean
  }

  class ImageEditor {
    constructor(element: HTMLElement, options: ImageEditorOptions)
    toDataURL(options?: { format?: string; quality?: number }): string
    destroy(): void
  }

  export default ImageEditor
}

declare module 'tui-image-editor/dist/tui-image-editor.css' {
  const content: string
  export default content
}
