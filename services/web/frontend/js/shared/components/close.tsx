import { useTranslation } from 'react-i18next'

type CloseProps = {
  onDismiss: React.MouseEventHandler<HTMLButtonElement>
  variant?: 'light' | 'dark'
}

function Close({ onDismiss, variant = 'light' }: CloseProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      className={`close pull-right ${variant}`}
      onClick={onDismiss}
    >
      <span aria-hidden="true">&times;</span>
      <span className="sr-only">{t('close')}</span>
    </button>
  )
}

export default Close
