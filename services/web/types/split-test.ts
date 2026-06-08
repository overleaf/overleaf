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
  labsDetails?: LabsDetails
}

export type LabsDetails = {
  isFull: boolean
  versionCreatedAt: string
  title: string
  description: string
  icon: string
  surveyLink: string
  successNotification?: {
    content?: string
    buttonLabel?: string
    buttonUrl?: string
  }
}
