import { useProjectSettingsContext } from '@/features/ide-settings/context/project-settings-context'

export const useAreTabsEnabled = () => {
  const { editorTabs } = useProjectSettingsContext()
  return Boolean(editorTabs)
}
