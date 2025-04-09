import { Card } from 'react-bootstrap-5'
import { FC } from 'react'

const OLCard: FC<{ className?: string }> = ({ children, className }) => {
  return (
    <Card className={className}>
      <Card.Body>{children}</Card.Body>
    </Card>
  )
}

export default OLCard
