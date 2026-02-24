import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useCallback } from 'react'
import { useStopOnFirstError } from '@/shared/hooks/use-stop-on-first-error'

export default function StopOnFirstErrorSetting() {
  const { stopOnFirstError } = useCompileContext()
  const { enableStopOnFirstError, disableStopOnFirstError } =
    useStopOnFirstError({ eventSource: 'settings-modal' })
  const { t } = useTranslation()
  const changeStopOnFirstError = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        enableStopOnFirstError()
      } else {
        disableStopOnFirstError()
      }
    },
    [enableStopOnFirstError, disableStopOnFirstError]
  )

  return (
    <ToggleSetting
      id="stopOnFirstError"
      label={t('stop_on_first_error')}
      description={t(
        'stops_compiling_after_the_first_error_so_you_can_fix_issues_one_at_a_time'
      )}
      checked={stopOnFirstError}
      onChange={changeStopOnFirstError}
    />
  )
}
