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
import customLocalStorage from '@/infrastructure/local-storage'
import { getLegacyWriteAndCiteMigration } from '../utils/write-and-cite-settings-migration'
import { saveUserSettings } from '@/features/editor-left-menu/utils/api'

export const defaultSettings: UserSettings = {
  pdfViewer: 'pdfjs',
  autoComplete: true,
  autoPairDelimiters: true,
  syntaxValidation: false,
  previewTabs: false,
  editorTheme: 'textmate',
  editorDarkTheme: 'overleaf_dark',
  editorLightTheme: 'textmate',
  overallTheme: '',
  mode: 'default',
  fontSize: 12,
  fontFamily: 'monaco',
  lineHeight: 'normal',
  mathPreview: true,
  referencesSearchMode: 'advanced',
  breadcrumbs: true,
  darkModePdf: false,
  zotero: {
    enabled: true,
    groups: [],
    disablePersonalLibrary: false,
  },
  mendeley: {
    enabled: true,
    groups: [],
    disablePersonalLibrary: false,
  },
  papers: {
    enabled: true,
    groups: [],
    disablePersonalLibrary: false,
  },
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

  useEffect(() => {
    const { patch, keysToRemove } = getLegacyWriteAndCiteMigration(userSettings)
    if (Object.keys(patch).length === 0) {
      keysToRemove.forEach(customLocalStorage.removeItem)
      return
    }

    Promise.all(
      Object.entries(patch).map(([key, value]) =>
        saveUserSettings(
          key as keyof Pick<UserSettings, 'mendeley' | 'zotero' | 'papers'>,
          value
        )
      )
    ).then(() => {
      setUserSettings(currentSettings => ({
        ...currentSettings,
        ...patch,
      }))
      keysToRemove.forEach(customLocalStorage.removeItem)
    })
    // Only run once when the provider mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
