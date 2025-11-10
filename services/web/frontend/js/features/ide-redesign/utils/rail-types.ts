import { AvailableUnfilledIcon } from '@/shared/components/material-icon'
import { RailTabKey } from '../contexts/rail-context'
import { ReactElement } from 'react'

export type RailElement = {
  icon: AvailableUnfilledIcon
  key: RailTabKey
  component: ReactElement | null
  indicator?: ReactElement
  title: string
  hide?: boolean | (() => boolean)
  disabled?: boolean
  mountOnFirstLoad?: boolean
}
