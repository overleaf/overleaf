export type CommandPaletteSearchResult = {
  title: string
  description?: string
  onSelect(self: CommandPaletteSearchResult): void | Promise<void>
  score: number
}

export type CommandPaletteSource = {
  id: string
  search(query: string): CommandPaletteSearchResult[]
  defaults?(): CommandPaletteSearchResult[]
}
