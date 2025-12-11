import { useActiveOverallTheme } from './use-active-overall-theme'
import { useUserSettingsContext } from '../context/user-settings-context'
import { isIEEEBranded } from '@/utils/is-ieee-branded'

export const useActiveEditorTheme = () => {
  const activeOverallTheme = useActiveOverallTheme()
  const {
    userSettings: {
      overallTheme,
      editorTheme,
      editorLightTheme,
      editorDarkTheme,
    },
  } = useUserSettingsContext()
  if (overallTheme !== 'system' || isIEEEBranded()) {
    return editorTheme
  } else {
    return activeOverallTheme === 'dark' ? editorDarkTheme : editorLightTheme
  }
}
