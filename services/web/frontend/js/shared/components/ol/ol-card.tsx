import { Card } from 'react-bootstrap'
import { FC } from 'react'

type OLCardProps = {
  children:
    | React.ReactNode
    | ((Component: typeof Card.Body) => React.ReactElement)
  className?: string
  'data-testid'?: string
}

const OLCard: FC<OLCardProps> = ({ children, className, ...rest }) => {
  return (
    <Card className={className} {...rest}>
      {typeof children === 'function' ? (
        children(Card.Body)
      ) : (
        <Card.Body>{children}</Card.Body>
      )}
    </Card>
  )
}

export default OLCard
