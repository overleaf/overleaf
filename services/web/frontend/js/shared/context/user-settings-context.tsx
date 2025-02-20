import {
  createContext,
  useContext,
  useMemo,
  Dispatch,
  SetStateAction,
  FC,
  useState,
  useEffect,
} from 'react'

import { UserSettings, Keybindings } from '../../../../types/user-settings'
import getMeta from '@/utils/meta'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { userStyles } from '../utils/styles'

const defaultSettings: UserSettings = {
  pdfViewer: 'pdfjs',
  autoComplete: true,
  autoPairDelimiters: true,
  syntaxValidation: false,
  editorTheme: 'textmate',
  overallTheme: '',
  mode: 'default',
  fontSize: 12,
  fontFamily: 'monaco',
  lineHeight: 'normal',
  mathPreview: true,
  referencesSearchMode: 'advanced',
}

type UserSettingsContextValue = {
  userSettings: UserSettings
  setUserSettings: Dispatch<
    SetStateAction<UserSettingsContextValue['userSettings']>
  >
}

type ScopeSettings = {
  overallTheme: 'light' | 'dark'
  keybindings: Keybindings
  fontSize: number
  fontFamily: string
  lineHeight: number
}

export const UserSettingsContext = createContext<
  UserSettingsContextValue | undefined
>(undefined)

export const UserSettingsProvider: FC = ({ children }) => {
  const [userSettings, setUserSettings] = useState<UserSettings>(
    () => getMeta('ol-userSettings') || defaultSettings
  )

  // update the global scope 'settings' value, for extensions
  const [, setScopeSettings] = useScopeValue<ScopeSettings>('settings')
  useEffect(() => {
    const { fontFamily, lineHeight } = userStyles(userSettings)
    setScopeSettings({
      overallTheme: userSettings.overallTheme === 'light-' ? 'light' : 'dark',
      keybindings: userSettings.mode === 'none' ? 'default' : userSettings.mode,
      fontFamily,
      lineHeight,
      fontSize: userSettings.fontSize,
    })
  }, [setScopeSettings, userSettings])

  const value = useMemo<UserSettingsContextValue>(
    () => ({
      userSettings,
      setUserSettings,
    }),
    [userSettings, setUserSettings]
  )

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  )
}

export function useUserSettingsContext() {
  const context = useContext(UserSettingsContext)
  if (!context) {
    throw new Error(
      'useUserSettingsContext is only available inside UserSettingsProvider'
    )
  }
  return context
}
