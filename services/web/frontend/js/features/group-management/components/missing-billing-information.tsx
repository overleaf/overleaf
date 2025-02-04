import { Trans, useTranslation } from 'react-i18next'
import { Card, CardBody, Row, Col } from 'react-bootstrap-5'
import getMeta from '@/utils/meta'
import IconButton from '@/features/ui/components/bootstrap-5/icon-button'
import OLNotification from '@/features/ui/components/ol/ol-notification'

function MissingBillingInformation() {
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
            <CardBody>
              <OLNotification
                type="error"
                title={t('missing_payment_details')}
                content={
                  <Trans
                    i18nKey="it_looks_like_your_payment_details_are_missing_please_update_your_billing_information"
                    components={[
                      // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                      <a href="/user/subscription" rel="noreferrer noopener" />,
                      // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                      <a href="/contact" rel="noreferrer noopener" />,
                    ]}
                  />
                }
                className="m-0"
              />
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default MissingBillingInformation
