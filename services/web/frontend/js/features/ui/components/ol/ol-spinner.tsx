import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import Icon from '@/shared/components/icon'
import { Spinner } from 'react-bootstrap-5'
import classNames from 'classnames'

export type OLSpinnerSize = 'sm' | 'lg'

function OLSpinner({ size = 'sm' }: { size: OLSpinnerSize }) {
  return (
    <BootstrapVersionSwitcher
      bs3={
        <Icon
          type="refresh"
          fw
          spin
          className={classNames({ 'fa-2x': size === 'lg' })}
        />
      }
      bs5={
        <Spinner
          size={size === 'sm' ? 'sm' : undefined}
          animation="border"
          aria-hidden="true"
          role="status"
        />
      }
    />
  )
}

export default OLSpinner
