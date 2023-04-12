import { Nullable } from '../../../../../../types/utils'

interface UpdateLabel {
  id: string
  comment: string
  version: number
  user_id: string
  created_at: string
}

export interface Label extends UpdateLabel {
  user_display_name: string
}

export interface PseudoCurrentStateLabel {
  id: '1'
  isPseudoCurrentStateLabel: true
  version: Nullable<number>
  created_at: string
}

export type LoadedLabel = Label | PseudoCurrentStateLabel
