import { Card, CardBody } from 'react-bootstrap-5'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { FC } from 'react'
import classNames from 'classnames'

// This wraps the Bootstrap 5 Card component but is restricted to the very
// basic way we're using it, which is as a container for page content. The
// Bootstrap 3 equivalent in our codebase is a div with class "card"
const OLPageContentCard: FC<{ className?: string }> = ({
  children,
  className,
}) => {
  return (
    <BootstrapVersionSwitcher
      bs3={<div className={classNames('card', className)}>{children}</div>}
      bs5={
        <Card className={classNames('page-content-card', className)}>
          <CardBody>{children}</CardBody>
        </Card>
      }
    />
  )
}

export default OLPageContentCard
