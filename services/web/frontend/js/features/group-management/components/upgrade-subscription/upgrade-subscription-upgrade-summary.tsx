import { useTranslation } from 'react-i18next'
import { Card, ListGroup } from 'react-bootstrap-5'
import { formatCurrencyLocalized } from '@/shared/utils/currency'
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
          {t('you_have_x_users_on_your_subscription', {
            groupSize: totalLicenses,
          })}
        </div>
        <div>
          <ListGroup>
            <ListGroup.Item className="bg-transparent border-0 px-0 gap-3 card-description-secondary">
              <span className="me-auto">
                {subscriptionChange.nextInvoice.plan.name} x {totalLicenses}{' '}
                {t('users')}
              </span>
              <span data-testid="subtotal">
                {formatCurrencyLocalized(
                  subscriptionChange.immediateCharge.subtotal,
                  subscriptionChange.currency
                )}
              </span>
            </ListGroup.Item>
            <ListGroup.Item className="bg-transparent border-0 px-0 gap-3 card-description-secondary">
              <span className="me-auto">{t('sales_tax')}</span>
              <span data-testid="tax">
                {formatCurrencyLocalized(
                  subscriptionChange.immediateCharge.tax,
                  subscriptionChange.currency
                )}
              </span>
            </ListGroup.Item>
            <ListGroup.Item className="bg-transparent border-0 px-0 gap-3 card-description-secondary">
              <strong className="me-auto">{t('total_due_today')}</strong>
              <strong data-testid="total">
                {formatCurrencyLocalized(
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
          {t('after_that_well_bill_you_x_annually_on_date_unless_you_cancel', {
            subtotal: formatCurrencyLocalized(
              subscriptionChange.nextInvoice.subtotal,
              subscriptionChange.currency
            ),
            date: formatTime(subscriptionChange.nextInvoice.date, 'MMMM D'),
          })}
        </div>
      </Card.Body>
    </Card>
  )
}

export default UpgradeSummary
