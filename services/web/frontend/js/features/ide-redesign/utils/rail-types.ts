import { AvailableUnfilledIcon } from '@/shared/components/material-icon'
import { RailTabKey } from '../contexts/rail-context'
import { FC, ReactElement } from 'react'

export type CustomRailTabIcon = FC<{ open: boolean; title: string }>

export type RailElement = {
  icon: AvailableUnfilledIcon | CustomRailTabIcon
  key: RailTabKey
  component: ReactElement | null
  indicator?: ReactElement
  title: string
  hide?: boolean | (() => boolean)
  disabled?: boolean
  mountOnFirstLoad?: boolean
  ref?: React.RefObject<HTMLAnchorElement>
}
