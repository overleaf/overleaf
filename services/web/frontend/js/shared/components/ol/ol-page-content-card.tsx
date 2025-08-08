import { Card, CardBody } from 'react-bootstrap'
import { FC } from 'react'
import classNames from 'classnames'

const OLPageContentCard: FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ children, className }) => {
  return (
    <Card className={classNames('page-content-card', className)}>
      <CardBody>{children}</CardBody>
    </Card>
  )
}

export default OLPageContentCard
