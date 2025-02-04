import getMeta from '@/utils/meta'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Row, Col } from 'react-bootstrap-5'
import MaterialIcon from '@/shared/components/material-icon'
import { formatCurrency } from '@/shared/utils/currency'

export const LICENSE_ADD_ON = 'additional-license'

function UpgradeSubscriptionPlanDetails() {
  const { t } = useTranslation()
  const preview = getMeta('ol-subscriptionChangePreview')
  const totalLicenses = getMeta('ol-totalLicenses')

  const licenseUnitPrice = useMemo(() => {
    const additionalLicenseAddOn = preview.nextInvoice.addOns.filter(
      addOn => addOn.code === LICENSE_ADD_ON
    )
    // Legacy plans might not have additional-license add-on.
    // Hence we need to compute unit price
    return additionalLicenseAddOn.length > 0
      ? additionalLicenseAddOn[0].unitAmount
      : preview.nextInvoice.plan.amount / totalLicenses
  }, [
    preview.nextInvoice.addOns,
    preview.nextInvoice.plan.amount,
    totalLicenses,
  ])

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
                {formatCurrency(
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
