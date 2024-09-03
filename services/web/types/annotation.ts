export type Annotation = {
  row: number
  type: 'info' | 'warning' | 'error'
  text: string
  source?: string
  ruleId?: string
  id: string
  entryIndex: number
  firstOnLine: boolean
  command?: string
}
