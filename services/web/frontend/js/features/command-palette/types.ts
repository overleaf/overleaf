export type CommandPaletteSelectSegmentation =
  | { source: 'file' }
  | { source: 'command-registry'; item: string }
  | { source: 'jump-to-line' }

export type CommandPaletteSearchResult = {
  title: string
  description?: string
  onSelect(self: CommandPaletteSearchResult): void | Promise<void>
  score: number
  eventSegmentation: CommandPaletteSelectSegmentation
}

export type CommandPaletteSource = {
  id: string
  search(query: string): CommandPaletteSearchResult[]
  defaults?(): CommandPaletteSearchResult[]
  prefix?: string
  prefixRequired?: boolean
}
