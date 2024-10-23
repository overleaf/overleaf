import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { CloseButton, CloseButtonProps } from 'react-bootstrap-5'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { forwardRef } from 'react'

const OLCloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(
  (props, ref) => {
    const { t } = useTranslation()

    const bs3CloseButtonProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {
      className: classNames('close', props.className),
      onClick: props.onClick,
      onMouseOver: props.onMouseOver,
      onMouseOut: props.onMouseOut,

      'aria-label': t('close'),
    }

    return (
      <BootstrapVersionSwitcher
        bs3={
          <button {...bs3CloseButtonProps}>
            <span aria-hidden="true">&times;</span>
          </button>
        }
        bs5={<CloseButton ref={ref} {...props} />}
      />
    )
  }
)

OLCloseButton.displayName = 'OLCloseButton'

export default OLCloseButton
