import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useCallback } from 'react'

export function useSetCompilationSettingWithEvent<T>(
  settingName: string,
  setter: (value: T) => void,
  options: { omitValueInEvent?: boolean } = {}
): (value: T) => void {
  const { sendEvent } = useEditorAnalytics()
  return useCallback(
    value => {
      const segmentation: { setting: string; settingVal?: T } = {
        setting: settingName,
      }
      if (!options.omitValueInEvent) {
        segmentation.settingVal = value
      }
      sendEvent('recompile-setting-changed', segmentation)
      setter(value)
    },
    [sendEvent, setter, settingName, options.omitValueInEvent]
  )
}
