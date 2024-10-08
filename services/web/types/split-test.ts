export type SplitTestInfo = {
  phase: string
  active: boolean
  archived: boolean
  missing?: boolean
  variants: {
    name: string
    rolloutPercent: number
  }[]
  hasOverride?: boolean
  badgeInfo?: {
    url?: string
    tooltipText?: string
  }
}
