import { Card } from 'react-bootstrap-5'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { FC } from 'react'
import classNames from 'classnames'

const OLCard: FC<{ className?: string }> = ({ children, className }) => {
  return (
    <BootstrapVersionSwitcher
      bs3={<div className={classNames('card', className)}>{children}</div>}
      bs5={
        <Card className={className}>
          <Card.Body>{children}</Card.Body>
        </Card>
      }
    />
  )
}

export default OLCard
