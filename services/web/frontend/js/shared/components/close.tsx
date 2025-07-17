import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

type CloseProps = {
  onDismiss: React.MouseEventHandler<HTMLButtonElement>
  variant?: 'light' | 'dark'
}

function Close({ onDismiss, variant = 'light' }: CloseProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      className={`close float-end ${variant}`}
      onClick={onDismiss}
    >
      <MaterialIcon
        type="close"
        className="align-text-bottom"
        accessibilityLabel={t('close')}
      />
    </button>
  )
}

export default Close
