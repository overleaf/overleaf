import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useCallback } from 'react'
import * as eventTracking from '../../../../../infrastructure/event-tracking'

export default function AutoCompileSetting() {
  const { autoCompile, setAutoCompile } = useCompileContext()
  const { t } = useTranslation()

  const sendEventAndSet = useCallback(
    (value: boolean) => {
      eventTracking.sendMB('recompile-setting-changed', {
        setting: 'auto-compile',
        settingVal: value,
      })
      setAutoCompile(value)
    },
    [setAutoCompile]
  )

  return (
    <ToggleSetting
      id="autoCompile"
      label={t('autocompile')}
      description={t('automatically_recompile_the_project_as_you_edit')}
      checked={autoCompile}
      onChange={sendEventAndSet}
    />
  )
}
