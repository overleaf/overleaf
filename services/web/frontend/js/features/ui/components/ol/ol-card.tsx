import { Card } from 'react-bootstrap'
import { FC } from 'react'

const OLCard: FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => {
  return (
    <Card className={className}>
      <Card.Body>{children}</Card.Body>
    </Card>
  )
}

export default OLCard
