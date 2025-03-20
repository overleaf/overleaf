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
      description={t('identify_errors_with_your_compile')}
      checked={stopOnFirstError}
      onChange={setStopOnFirstError}
    />
  )
}
