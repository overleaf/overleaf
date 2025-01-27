export type OutlineItemData = {
  line: number
  title: string
  level?: number
  children?: OutlineItemData[]
  from?: number
  to?: number
}
