import getMeta from '@/utils/meta'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Row, Col } from 'react-bootstrap-5'
import MaterialIcon from '@/shared/components/material-icon'
import { formatCurrencyLocalized } from '@/shared/utils/currency'

const LICENSE_ADD_ON = 'additional-license'

function UpgradeSubscriptionPlanDetails() {
  const { t } = useTranslation()
  const preview = getMeta('ol-subscriptionChangePreview')

  const licenseUnitPrice = useMemo(
    () =>
      preview.nextInvoice.addOns.filter(
        addOn => addOn.code === LICENSE_ADD_ON
      )[0].unitAmount,
    [preview]
  )

  return (
    <Card
      className="group-subscription-upgrade-features card-description-secondary border-1"
      border="light"
    >
      <Card.Body className="d-grid gap-3 p-3">
        <b>{preview.nextInvoice.plan.name}</b>
        <Row xs="auto" className="gx-2">
          <Col>
            <span className="per-user-price" data-testid="per-user-price">
              <b>
                {formatCurrencyLocalized(
                  licenseUnitPrice,
                  preview.currency,
                  getMeta('ol-i18n')?.currentLangCode ?? 'en',
                  true
                )}
              </b>
            </span>
          </Col>
          <Col className="d-flex flex-column justify-content-center">
            <div className="per-user-price-text">{t('per_user')}</div>
            <div className="per-user-price-text">{t('billed_yearly')}</div>
          </Col>
        </Row>
        <div className="feature-list-item">
          <b>{t('all_features_in_group_standard_plus')}</b>
        </div>
        <div className="ps-2 feature-list-item">
          <MaterialIcon type="check" className="me-1" />
          {t('unlimited_collaborators_per_project')}
        </div>
        <div className="ps-2 feature-list-item">
          <MaterialIcon type="check" className="me-1" />
          {t('sso')}
        </div>
        <div className="ps-2 feature-list-item">
          <MaterialIcon type="check" className="me-1" />
          {t('managed_user_accounts')}
        </div>
      </Card.Body>
    </Card>
  )
}

export default UpgradeSubscriptionPlanDetails
