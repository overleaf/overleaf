import { useCallback } from 'react'
import { Grid, Row, Col, Button } from 'react-bootstrap'
import moment from 'moment'
import { useTranslation, Trans } from 'react-i18next'
import { SubscriptionChangePreview } from '../../../../../../types/subscription/subscription-change-preview'
import getMeta from '@/utils/meta'
import { formatCurrencyLocalized } from '@/shared/utils/currency'
import useAsync from '@/shared/hooks/use-async'
import { useLocation } from '@/shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import { postJSON } from '@/infrastructure/fetch-json'
import Notification from '@/shared/components/notification'

function PreviewSubscriptionChange() {
  const preview = getMeta('ol-subscriptionChangePreview')
  const { t } = useTranslation()
  const payNowTask = useAsync()
  const location = useLocation()

  const handlePayNowClick = useCallback(() => {
    payNowTask
      .runAsync(payNow(preview))
      .then(() => {
        location.replace('/user/subscription/thank-you')
      })
      .catch(debugConsole.error)
  }, [location, payNowTask, preview])

  return (
    <Grid>
      <Row>
        <Col md={8} mdOffset={2}>
          <div className="card p-5">
            {preview.change.type === 'add-on-purchase' && (
              <h1>
                {t('add_add_on_to_your_plan', {
                  addOnName: preview.change.addOn.name,
                })}
              </h1>
            )}

            {payNowTask.isError && (
              <Notification
                type="error"
                aria-live="polite"
                content={
                  <>
                    {t('generic_something_went_wrong')}. {t('try_again')}.{' '}
                    {t('generic_if_problem_continues_contact_us')}.
                  </>
                }
              />
            )}

            <div className="payment-summary-card mt-5">
              <h3>{t('payment_summary')}</h3>
              <Row>
                <Col xs={9}>
                  <strong>{t('due_today')}:</strong>
                </Col>
                <Col xs={3} className="text-right">
                  <strong>
                    {formatCurrencyLocalized(
                      preview.immediateCharge,
                      preview.currency
                    )}
                  </strong>
                </Col>
              </Row>

              <hr />

              <div>
                <strong>{t('future_payments')}:</strong>
              </div>

              <Row className="mt-1">
                <Col xs={9}>{preview.nextInvoice.plan.name}</Col>
                <Col xs={3} className="text-right">
                  {formatCurrencyLocalized(
                    preview.nextInvoice.plan.amount,
                    preview.currency
                  )}
                </Col>
              </Row>

              {preview.nextInvoice.addOns.map(addOn => (
                <Row className="mt-1" key={addOn.code}>
                  <Col xs={9}>
                    {addOn.name}
                    {addOn.quantity > 1 ? ` ×${addOn.quantity}` : ''}
                  </Col>
                  <Col xs={3} className="text-right">
                    {formatCurrencyLocalized(addOn.amount, preview.currency)}
                  </Col>
                </Row>
              ))}

              {preview.nextInvoice.tax.rate > 0 && (
                <Row className="mt-1">
                  <Col xs={9}>
                    {t('vat')} {preview.nextInvoice.tax.rate * 100}%
                  </Col>
                  <Col xs={3} className="text-right">
                    {formatCurrencyLocalized(
                      preview.nextInvoice.tax.amount,
                      preview.currency
                    )}
                  </Col>
                </Row>
              )}

              <Row className="mt-1">
                <Col xs={9}>{t('total_per_month')}</Col>
                <Col xs={3} className="text-right">
                  {formatCurrencyLocalized(
                    preview.nextInvoice.total,
                    preview.currency
                  )}
                </Col>
              </Row>
            </div>

            <div className="mt-5">
              <Trans
                i18nKey="the_next_payment_will_be_collected_on"
                values={{ date: moment(preview.nextInvoice.date).format('LL') }}
                components={{ strong: <strong /> }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
              />{' '}
              <Trans
                i18nKey="the_payment_method_used_is"
                values={{ paymentMethod: preview.paymentMethod }}
                components={{ strong: <strong /> }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
              />
            </div>

            <div className="mt-5">
              <Button
                bsStyle="primary"
                bsSize="large"
                onClick={handlePayNowClick}
                disabled={payNowTask.isLoading || payNowTask.isSuccess}
              >
                {t('pay_now')}
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Grid>
  )
}

async function payNow(preview: SubscriptionChangePreview) {
  if (preview.change.type === 'add-on-purchase') {
    await postJSON(`/user/subscription/addon/${preview.change.addOn.code}/add`)
  } else {
    throw new Error(
      `Unknown subscription change preview type: ${preview.change.type}`
    )
  }
}
export default PreviewSubscriptionChange
