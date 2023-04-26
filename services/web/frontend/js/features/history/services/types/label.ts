import { Nullable } from '../../../../../../types/utils'

interface LabelBase {
  id: string
  created_at: string
}

interface UpdateLabel extends LabelBase {
  comment: string
  version: number
  user_id: string
}

export interface Label extends UpdateLabel {
  user_display_name: string
}

export interface PseudoCurrentStateLabel extends LabelBase {
  id: '1'
  isPseudoCurrentStateLabel: true
  version: Nullable<number>
}

export type LoadedLabel = Label | PseudoCurrentStateLabel
