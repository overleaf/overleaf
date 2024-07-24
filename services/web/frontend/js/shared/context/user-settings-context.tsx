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

import { UserSettings } from '../../../../types/user-settings'
import getMeta from '@/utils/meta'

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
}

type UserSettingsContextValue = {
  userSettings: UserSettings
  setUserSettings: Dispatch<
    SetStateAction<UserSettingsContextValue['userSettings']>
  >
}

export const UserSettingsContext = createContext<
  UserSettingsContextValue | undefined
>(undefined)

export const UserSettingsProvider: FC = ({ children }) => {
  const [userSettings, setUserSettings] = useState<
    UserSettingsContextValue['userSettings']
  >(() => getMeta('ol-userSettings') || defaultSettings)

  const value = useMemo<UserSettingsContextValue>(
    () => ({
      userSettings,
      setUserSettings,
    }),
    [userSettings, setUserSettings]
  )

  // Fire an event to inform non-React code of settings changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('settings:change', { detail: userSettings })
    )
  }, [userSettings])

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
