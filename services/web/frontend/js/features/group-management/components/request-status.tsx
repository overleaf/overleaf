import { useTranslation } from 'react-i18next'
import { Card, CardBody, Row, Col } from 'react-bootstrap-5'
import Button from '@/features/ui/components/bootstrap-5/button'
import MaterialIcon from '@/shared/components/material-icon'
import getMeta from '@/utils/meta'
import IconButton from '@/features/ui/components/bootstrap-5/icon-button'
import classnames from 'classnames'

type RequestStatusProps = {
  icon: string
  title: string
  content?: React.ReactNode
  variant?: 'primary' | 'danger'
}

function RequestStatus({ icon, title, content, variant }: RequestStatusProps) {
  const { t } = useTranslation()
  const groupName = getMeta('ol-groupName')

  return (
    <div className="container">
      <Row>
        <Col xxl={5} xl={6} lg={7} md={9} className="mx-auto">
          <div className="group-heading" data-testid="group-heading">
            <IconButton
              variant="ghost"
              href="/user/subscription"
              size="lg"
              icon="arrow_back"
              accessibilityLabel={t('back_to_subscription')}
            />
            <h2>{groupName || t('group_subscription')}</h2>
          </div>
          <Card>
            <CardBody className="d-grid gap-3">
              <div
                className={classnames('card-icon', {
                  [`text-${variant}`]: variant,
                })}
              >
                <MaterialIcon type={icon} />
              </div>
              <div className="d-grid gap-2 text-center">
                <h3 className="mb-0 fw-bold" data-testid="title">
                  {title}
                </h3>
                {content && (
                  <div className="card-description-secondary">{content}</div>
                )}
              </div>
              <div className="text-center">
                <Button variant="secondary" href="/user/subscription">
                  {t('go_to_subscriptions')}
                </Button>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default RequestStatus
