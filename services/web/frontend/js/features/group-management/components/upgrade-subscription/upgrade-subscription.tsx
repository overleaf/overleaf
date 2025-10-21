import getMeta from '@/utils/meta'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import { useTranslation, Trans } from 'react-i18next'
import { Card, Row, Col } from 'react-bootstrap'
import IconButton from '@/shared/components/button/icon-button'
import Button from '@/shared/components/button/button'
import UpgradeSubscriptionPlanDetails from './upgrade-subscription-plan-details'
import RequestStatus from '../request-status'
import UpgradeSummary, {
  SubscriptionChange,
} from './upgrade-subscription-upgrade-summary'
import { debugConsole } from '@/utils/debugging'
import { sendMB } from '../../../../infrastructure/event-tracking'
import handleStripePaymentAction from '@/features/subscription/util/handle-stripe-payment-action'
import { useState } from 'react'

function UpgradeSubscription() {
  const { t } = useTranslation()
  const groupName = getMeta('ol-groupName')
  const preview = getMeta('ol-subscriptionChangePreview') as SubscriptionChange
  const isRedirectedPaymentError = Boolean(
    getMeta('ol-subscriptionPaymentErrorCode')
  )
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const onSubmit = async () => {
    sendMB('flex-upgrade-form', {
      action: 'click-upgrade-button',
    })
    setIsLoading(true)

    try {
      await postJSON('/user/subscription/group/upgrade-subscription')
      sendMB('flex-upgrade-success')
      setIsSuccess(true)
    } catch (error) {
      const { handled } = await handleStripePaymentAction(error as FetchError)
      if (handled) {
        sendMB('flex-upgrade-success')
        setIsSuccess(true)
        return
      }
      debugConsole.error(error)
      sendMB('flex-upgrade-error')
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <RequestStatus
        variant="primary"
        icon="check_circle"
        title={t('youve_upgraded_your_plan')}
      />
    )
  }

  if (isRedirectedPaymentError || isError) {
    return (
      <RequestStatus
        variant="danger"
        icon="error"
        title={t('something_went_wrong')}
        content={
          <Trans
            i18nKey="it_looks_like_that_didnt_work_you_can_try_again_or_get_in_touch"
            components={[
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              <a
                href="/contact"
                onClick={() => {
                  sendMB('flex-upgrade-form', {
                    action: 'click-get-in-touch-link',
                  })
                }}
              />,
            ]}
          />
        }
      />
    )
  }

  return (
    <div className="container">
      <Row>
        <Col xl={{ span: 8, offset: 2 }}>
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
          <Card className="card-description-secondary group-subscription-upgrade-card">
            <Card.Body className="d-grid gap-2">
              <b className="title">{t('upgrade_your_subscription')}</b>
              <p>
                <Trans
                  i18nKey="group_plan_upgrade_description"
                  values={{
                    currentPlan: preview.change.prevPlan.name,
                    nextPlan: preview.nextInvoice.plan.name,
                  }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                  components={[
                    // eslint-disable-next-line react/jsx-key
                    <strong />,
                    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                    <a href="/contact" />,
                  ]}
                />
              </p>
              <Row className="mb-2">
                <Col md={{ span: 6 }} className="mb-2">
                  <UpgradeSubscriptionPlanDetails />
                </Col>
                <Col md={{ span: 6 }}>
                  <UpgradeSummary subscriptionChange={preview} />
                </Col>
              </Row>
              <div className="d-flex align-items-center justify-content-end gap-2">
                <a
                  href="/user/subscription/group/add-users"
                  className="me-auto"
                  onClick={() => sendMB('flex-add-users')}
                >
                  {t('add_more_licenses_to_my_plan')}
                </a>
                <Button
                  href="/user/subscription"
                  variant="secondary"
                  disabled={isLoading}
                  onClick={() => {
                    sendMB('flex-upgrade-form', {
                      action: 'click-cancel-button',
                    })
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={onSubmit}
                  isLoading={isLoading}
                >
                  {t('upgrade')}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default UpgradeSubscription
