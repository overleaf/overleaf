import { Trans, useTranslation } from 'react-i18next'
import { Card, ListGroup } from 'react-bootstrap'
import { formatCurrency } from '@/shared/utils/currency'
import { formatTime } from '@/features/utils/format-date'
import {
  AddOnUpdate,
  SubscriptionChangePreview,
} from '../../../../../../types/subscription/subscription-change-preview'
import { MergeAndOverride } from '../../../../../../types/utils'
import getMeta from '@/utils/meta'

type CostSummaryProps = {
  subscriptionChange: MergeAndOverride<
    SubscriptionChangePreview,
    { change: AddOnUpdate }
  > | null
  totalLicenses: number
}

function CostSummary({ subscriptionChange, totalLicenses }: CostSummaryProps) {
  const { t } = useTranslation()
  const isCollectionMethodManual = getMeta('ol-isCollectionMethodManual')
  const factor = 100

  return (
    <Card
      className="card-gray card-description-secondary"
      data-testid="cost-summary"
    >
      <Card.Body className="d-grid gap-2 p-3">
        <div data-testid="adding-licenses-summary">
          <div className="fw-bold">{t('cost_summary')}</div>
          {subscriptionChange ? (
            <Trans
              i18nKey="youre_adding_x_licenses_to_your_plan_giving_you_a_total_of_y_licenses"
              components={[
                <b />, // eslint-disable-line react/jsx-key
                <b />, // eslint-disable-line react/jsx-key
              ]}
              values={{
                adding:
                  subscriptionChange.change.addOn.quantity -
                  subscriptionChange.change.addOn.prevQuantity,
                total:
                  totalLicenses +
                  subscriptionChange.change.addOn.quantity -
                  subscriptionChange.change.addOn.prevQuantity,
              }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          ) : (
            t(
              'enter_the_number_of_licenses_youd_like_to_add_to_see_the_cost_breakdown'
            )
          )}
        </div>
        {subscriptionChange && (
          <>
            <div>
              <ListGroup>
                <ListGroup.Item
                  className="bg-transparent border-0 px-0 gap-3 card-description-secondary"
                  data-testid="plan"
                >
                  <span className="me-auto">
                    {subscriptionChange.nextInvoice.plan.name} x{' '}
                    {subscriptionChange.change.addOn.quantity -
                      subscriptionChange.change.addOn.prevQuantity}{' '}
                    {t('licenses')}
                  </span>
                  <span data-testid="price">
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
                <ListGroup.Item
                  className="bg-transparent border-0 px-0 gap-3 card-description-secondary"
                  data-testid="tax"
                >
                  <span className="me-auto">
                    {t('vat')} &middot;{' '}
                    {Math.round(
                      subscriptionChange.nextInvoice.tax.rate * 100 * factor
                    ) / factor}
                    %
                  </span>
                  <span data-testid="price">
                    {formatCurrency(
                      subscriptionChange.immediateCharge.tax,
                      subscriptionChange.currency
                    )}
                  </span>
                </ListGroup.Item>
                <ListGroup.Item
                  className="bg-transparent border-0 px-0 gap-3 card-description-secondary"
                  data-testid="total"
                >
                  <strong className="me-auto">
                    {isCollectionMethodManual
                      ? t('total_due_in_x_days', {
                          days: subscriptionChange.netTerms,
                        })
                      : t('total_due_today')}
                  </strong>
                  <strong data-testid="price">
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
              {isCollectionMethodManual
                ? t(
                    'we_will_invoice_you_now_for_the_additional_licenses_based_on_remaining_months',
                    { days: subscriptionChange.netTerms }
                  )
                : t(
                    'we_will_charge_you_now_for_the_cost_of_your_additional_licenses_based_on_remaining_months'
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
          </>
        )}
      </Card.Body>
    </Card>
  )
}

export default CostSummary
