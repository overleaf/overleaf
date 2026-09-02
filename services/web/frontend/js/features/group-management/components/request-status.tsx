import { useTranslation } from 'react-i18next'
import { Card, CardBody, Row, Col } from 'react-bootstrap'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import getMeta from '@/utils/meta'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
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
            <OLIconButton
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
                <OLButton variant="secondary" href="/user/subscription">
                  {t('go_to_subscriptions')}
                </OLButton>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default RequestStatus
