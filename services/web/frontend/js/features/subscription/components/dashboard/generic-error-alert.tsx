import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

export default function GenericErrorAlert({
  className,
}: {
  className?: string
}) {
  const { t } = useTranslation()
  const alertClassName = classNames('alert', 'alert-danger', className)

  return (
    <div className={alertClassName} aria-live="polite">
      {t('generic_something_went_wrong')}. {t('try_again')}.{' '}
      {t('generic_if_problem_continues_contact_us')}.
    </div>
  )
}
