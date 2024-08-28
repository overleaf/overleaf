import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
      <BootstrapVersionSwitcher
        bs3={<span aria-hidden="true">&times;</span>}
        bs5={
          <MaterialIcon
            type="close"
            className="align-text-bottom"
            accessibilityLabel={t('close')}
          />
        }
      />
      <span className="sr-only">{t('close')}</span>
    </button>
  )
}

export default Close
