import { useTranslation } from 'react-i18next'
import { Card, CardBody, Row, Col } from 'react-bootstrap-5'
import Button from '@/features/ui/components/bootstrap-5/button'
import MaterialIcon from '@/shared/components/material-icon'
import getMeta from '@/utils/meta'
import IconButton from '@/features/ui/components/bootstrap-5/icon-button'

function RequestConfirmation() {
  const { t } = useTranslation()
  const groupName = getMeta('ol-groupName')

  return (
    <div className="container">
      <Row>
        <Col xl={{ span: 4, offset: 4 }} md={{ span: 6, offset: 3 }}>
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
              <div className="card-icon">
                <MaterialIcon type="email" />
              </div>
              <div className="d-grid gap-2 text-center">
                <h3 className="mb-0 fw-bold">{t('we_got_your_request')}</h3>
                <div className="card-description-secondary">
                  {t('our_team_will_get_back_to_you_shortly')}
                </div>
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

export default RequestConfirmation
