import type { ReactNode } from 'react'
import type { AvailableUnfilledIcon } from '@/shared/components/material-icon'

export type Setting = {
  key: string
  component: ReactNode
  hidden?: boolean
}

export type SettingsSection = {
  title?: string
  key: string
  settings: Setting[]
}

export type SettingsSectionHook = () => SettingsSection | null

export type SettingsTab = {
  key: string
  icon: AvailableUnfilledIcon
  sections: SettingsSection[]
  title: string
  hidden?: boolean
}

export type SettingsLink = {
  key: string
  icon: AvailableUnfilledIcon
  href: string
  title: string
  hidden?: boolean
}

export type SettingsEntry = SettingsLink | SettingsTab
