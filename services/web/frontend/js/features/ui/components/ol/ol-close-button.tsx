import { CloseButton, CloseButtonProps } from 'react-bootstrap-5'
import { useTranslation } from 'react-i18next'
import { forwardRef } from 'react'

const OLCloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(
  (props, ref) => {
    const { t } = useTranslation()

    return <CloseButton ref={ref} aria-label={t('close')} {...props} />
  }
)

OLCloseButton.displayName = 'OLCloseButton'

export default OLCloseButton
