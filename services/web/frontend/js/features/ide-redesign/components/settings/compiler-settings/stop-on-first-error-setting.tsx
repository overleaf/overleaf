import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'

export default function StopOnFirstErrorSetting() {
  const { stopOnFirstError, setStopOnFirstError } = useCompileContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="stopOnFirstError"
      label={t('stop_on_first_error')}
      description={t(
        'stops_compiling_after_the_first_error_so_you_can_fix_issues_one_at_a_time'
      )}
      checked={stopOnFirstError}
      onChange={setStopOnFirstError}
    />
  )
}
