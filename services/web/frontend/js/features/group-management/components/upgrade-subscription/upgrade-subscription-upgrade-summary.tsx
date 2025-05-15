import { useTranslation } from 'react-i18next'
import { Card, ListGroup } from 'react-bootstrap'
import { formatCurrency } from '@/shared/utils/currency'
import { formatTime } from '@/features/utils/format-date'
import {
  GroupPlanUpgrade,
  SubscriptionChangePreview,
} from '../../../../../../types/subscription/subscription-change-preview'
import { MergeAndOverride } from '../../../../../../types/utils'
import getMeta from '@/utils/meta'

export type SubscriptionChange = MergeAndOverride<
  SubscriptionChangePreview,
  { change: GroupPlanUpgrade }
>

type UpgradeSummaryProps = {
  subscriptionChange: SubscriptionChange
}

function UpgradeSummary({ subscriptionChange }: UpgradeSummaryProps) {
  const { t } = useTranslation()
  const totalLicenses = getMeta('ol-totalLicenses')

  return (
    <Card className="card-gray card-description-secondary">
      <Card.Body className="d-grid gap-2 p-3">
        <div>
          <div className="fw-bold">{t('upgrade_summary')}</div>
          {t('you_have_x_licenses_on_your_subscription', {
            groupSize: totalLicenses,
          })}
        </div>
        <div>
          <ListGroup>
            <ListGroup.Item className="bg-transparent border-0 px-0 gap-3 card-description-secondary">
              <span className="me-auto">
                {subscriptionChange.nextInvoice.plan.name} x {totalLicenses}{' '}
                {t('licenses')}
              </span>
              <span data-testid="subtotal">
                {formatCurrency(
                  subscriptionChange.immediateCharge.subtotal,
                  subscriptionChange.currency
                )}
              </span>
            </ListGroup.Item>
            {subscriptionChange.immediateCharge.discount !== 0 && (
              <ListGroup.Item className="bg-transparent border-0 px-0 gap-3 card-description-secondary">
                <span className="me-auto">{t('discount')}</span>
                <span data-testid="discount">
                  (
                  {formatCurrency(
                    subscriptionChange.immediateCharge.discount,
                    subscriptionChange.currency
                  )}
                  )
                </span>
              </ListGroup.Item>
            )}
            <ListGroup.Item className="bg-transparent border-0 px-0 gap-3 card-description-secondary">
              <span className="me-auto">{t('vat')}</span>
              <span data-testid="tax">
                {formatCurrency(
                  subscriptionChange.immediateCharge.tax,
                  subscriptionChange.currency
                )}
              </span>
            </ListGroup.Item>
            <ListGroup.Item className="bg-transparent border-0 px-0 gap-3 card-description-secondary">
              <strong className="me-auto">{t('total_due_today')}</strong>
              <strong data-testid="total">
                {formatCurrency(
                  subscriptionChange.immediateCharge.total,
                  subscriptionChange.currency
                )}
              </strong>
            </ListGroup.Item>
          </ListGroup>
          <hr className="m-0" />
        </div>
        <div>
          {t(
            'we_will_charge_you_now_for_your_new_plan_based_on_the_remaining_months_of_your_current_subscription'
          )}
        </div>
        <div>
          {t(
            'after_that_well_bill_you_x_total_y_subtotal_z_tax_annually_on_date_unless_you_cancel',
            {
              totalAmount: formatCurrency(
                subscriptionChange.nextInvoice.total,
                subscriptionChange.currency
              ),
              subtotalAmount: formatCurrency(
                subscriptionChange.nextInvoice.subtotal,
                subscriptionChange.currency
              ),
              taxAmount: formatCurrency(
                subscriptionChange.nextInvoice.tax.amount,
                subscriptionChange.currency
              ),
              date: formatTime(
                subscriptionChange.nextInvoice.date,
                'MMMM D',
                true
              ),
            }
          )}
          {subscriptionChange.immediateCharge.discount !== 0 &&
            ` ${t('coupons_not_included')}.`}
        </div>
      </Card.Body>
    </Card>
  )
}

export default UpgradeSummary
