import { Card, CardBody, CardProps } from 'react-bootstrap-5'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { FC } from 'react'

// This wraps the Bootstrap 5 Card component but is restricted to the very
// basic way we're using it, which is as a container for page content. The
// Bootstrap 3 equivalent in our codebase is a div with class "card"
const OLCard: FC<CardProps> = ({ children, ...rest }) => {
  return (
    <BootstrapVersionSwitcher
      bs3={
        <div className="card" {...rest}>
          {children}
        </div>
      }
      bs5={
        <Card {...rest}>
          <CardBody>{children}</CardBody>
        </Card>
      }
    />
  )
}

export default OLCard
