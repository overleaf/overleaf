import { useTranslation } from 'react-i18next'
import classnames from 'classnames'

type CloseProps = {
  onDismiss: () => void
} & React.ComponentProps<'div'>

function Close({ onDismiss, className, ...props }: CloseProps) {
  const { t } = useTranslation()

  return (
    <div className={classnames('notification-close', className)} {...props}>
      <button type="button" className="close pull-right" onClick={onDismiss}>
        <span aria-hidden="true">&times;</span>
        <span className="sr-only">{t('close')}</span>
      </button>
    </div>
  )
}

export default Close
