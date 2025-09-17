export interface WritefullWindow {
  cache: any
  cm6: any
  editor: any
  overleafUserId?: string
  overleafLabels?: Record<
    string,
    | string
    | number
    | string[]
    | number[]
    | boolean
    | Record<string, string | boolean>
  >
  plugins?: string[]
  type: 'integration' | 'extension'
  iconPosition?: {
    parentSelector: string
    insertBeforeSelector?: string
  }
  toolbarPosition?: {
    parentSelector: string
    insertBeforeSelector?: string
  }
  openTableGenerator: () => void
  openEquationGenerator: () => void
  refreshSession: () => void
}
