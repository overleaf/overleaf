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
import { userStyles } from '../utils/styles'
import { canUseNewEditor } from '@/features/ide-redesign/utils/new-editor-utils'
import { useIdeContext } from '@/shared/context/ide-context'

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
  enableNewEditor: true,
  breadcrumbs: true,
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

export const UserSettingsProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [userSettings, setUserSettings] = useState<UserSettings>(
    () => getMeta('ol-userSettings') || defaultSettings
  )

  // update the global scope 'settings' value, for extensions
  const { unstableStore } = useIdeContext()
  useEffect(() => {
    const { fontFamily, lineHeight } = userStyles(userSettings)
    unstableStore.set('settings', {
      overallTheme: userSettings.overallTheme === 'light-' ? 'light' : 'dark',
      keybindings: userSettings.mode === 'none' ? 'default' : userSettings.mode,
      fontFamily,
      lineHeight,
      fontSize: userSettings.fontSize,
      isNewEditor: canUseNewEditor() && userSettings.enableNewEditor,
    })
  }, [unstableStore, userSettings])

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
