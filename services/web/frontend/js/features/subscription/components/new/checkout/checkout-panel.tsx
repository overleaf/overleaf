import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePaymentContext } from '../../../context/payment-context'
import { Row, Col, Alert } from 'react-bootstrap'
import PriceSwitchHeader from './price-switch-header'
import PaymentMethodToggle from './payment-method-toggle'
import CardElement from './card-element'
import FirstName from './first-name'
import LastName from './last-name'
import AddressFirstLine from './address-first-line'
import AddressSecondLine from './address-second-line'
import PostalCode from './postal-code'
import CountrySelect from './country-select'
import CompanyDetails from './company-details'
import CouponCode from './coupon-code'
import TosAgreementNotice from './tos-agreement-notice'
import SubmitButton from './submit-button'
import ThreeDSecure from './three-d-secure'
import getMeta from '../../../../../utils/meta'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import classnames from 'classnames'
import {
  TokenPayload,
  RecurlyError,
  ElementsInstance,
  PayPalInstance,
} from 'recurly__recurly-js'
import { PricingFormState } from '../../../context/types/payment-context-value'
import { CreateError } from '../../../../../../../types/subscription/api'
import { CardElementChangeState } from '../../../../../../../types/recurly/elements'
import { useLocation } from '../../../../../shared/hooks/use-location'

function CheckoutPanel() {
  const { t } = useTranslation()
  const {
    couponError,
    currencyCode,
    planCode,
    planName,
    pricingFormState,
    pricing,
    recurlyLoadError,
    setPricingFormState,
    trialLength,
    taxes,
  } = usePaymentContext()
  const showCouponField: boolean = getMeta('ol-showCouponField')
  const ITMCampaign: string = getMeta('ol-itm_campaign', '')
  const ITMContent: string = getMeta('ol-itm_content', '')
  const ITMReferrer: string = getMeta('ol-itm_referrer', '')
  const formRef = useRef<HTMLFormElement>(null)
  const cachedRecurlyBillingToken = useRef<TokenPayload>()
  const elements = useRef<ElementsInstance | undefined>(recurly?.Elements())
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorFields, setErrorFields] = useState<Record<string, boolean>>()
  const [genericError, setGenericError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('credit_card')
  const [cardIsValid, setCardIsValid] = useState<boolean>()
  const [formIsValid, setFormIsValid] = useState<boolean>()
  const [threeDSecureActionTokenId, setThreeDSecureActionTokenId] =
    useState<string>()
  const location = useLocation()

  const isCreditCardPaymentMethod = paymentMethod === 'credit_card'
  const isPayPalPaymentMethod = paymentMethod === 'paypal'
  const isAddCompanyDetailsChecked = Boolean(
    formRef.current?.querySelector<HTMLInputElement>(
      '#add-company-details-checkbox'
    )?.checked
  )

  const completeSubscription = useCallback(
    async (
      err?: RecurlyError | null,
      recurlyBillingToken?: TokenPayload,
      threeDResultToken?: TokenPayload
    ) => {
      if (recurlyBillingToken) {
        // temporary store the billing token as it might be needed when
        // re-sending the request after SCA authentication
        cachedRecurlyBillingToken.current = recurlyBillingToken
      }

      setErrorFields(undefined)

      if (err) {
        eventTracking.sendMB('payment-page-form-error', err)
        eventTracking.send('subscription-funnel', 'subscription-error')

        setIsProcessing(false)
        setGenericError(err.message)

        const errFields = err.fields?.reduce<typeof errorFields>(
          (prev, cur) => {
            return { ...prev, [cur]: true }
          },
          {}
        )
        setErrorFields(errFields)
      } else {
        const billingFields = ['company', 'vat_number'] as const
        const billingInfo = billingFields.reduce((prev, cur) => {
          if (isPayPalPaymentMethod && isAddCompanyDetailsChecked) {
            prev[cur] = pricingFormState[cur]
          }

          return prev
        }, {} as Partial<Pick<PricingFormState, typeof billingFields[number]>>)

        const postData = {
          _csrf: getMeta('ol-csrfToken'),
          recurly_token_id: cachedRecurlyBillingToken.current?.id,
          recurly_three_d_secure_action_result_token_id: threeDResultToken?.id,
          subscriptionDetails: {
            currencyCode: pricing.current?.items.currency,
            plan_code: pricing.current?.items.plan?.code,
            coupon_code: pricing.current?.items.coupon?.code ?? '',
            first_name: pricingFormState.first_name,
            last_name: pricingFormState.last_name,
            isPaypal: isPayPalPaymentMethod,
            address: {
              address1: pricingFormState.address1,
              address2: pricingFormState.address2,
              country: pricingFormState.country,
              state: pricingFormState.state,
              zip: pricingFormState.postal_code,
            },
            ITMCampaign,
            ITMContent,
            ITMReferrer,
            ...(Object.keys(billingInfo).length && {
              billing_info: billingInfo,
            }),
          },
        }

        eventTracking.sendMB('payment-page-form-submit', {
          currencyCode: postData.subscriptionDetails.currencyCode,
          plan_code: postData.subscriptionDetails.plan_code,
          coupon_code: postData.subscriptionDetails.coupon_code,
          isPaypal: postData.subscriptionDetails.isPaypal,
        })
        eventTracking.send(
          'subscription-funnel',
          'subscription-form-submitted',
          postData.subscriptionDetails.plan_code
        )

        try {
          await postJSON(`/user/subscription/create`, { body: postData })

          eventTracking.sendMB('payment-page-form-success')
          eventTracking.send(
            'subscription-funnel',
            'subscription-submission-success',
            planCode
          )
          location.assign('/user/subscription/thank-you')
        } catch (error) {
          setIsProcessing(false)

          const { data } = error as CreateError
          const errorMessage: string =
            data.message || t('something_went_wrong_processing_the_request')
          setGenericError(errorMessage)

          if (data.threeDSecureActionTokenId) {
            setThreeDSecureActionTokenId(data.threeDSecureActionTokenId)
          }
        }
      }
    },
    [
      ITMCampaign,
      ITMContent,
      ITMReferrer,
      isAddCompanyDetailsChecked,
      isPayPalPaymentMethod,
      location,
      planCode,
      pricing,
      pricingFormState,
      t,
    ]
  )

  const payPal = useRef<PayPalInstance>()

  useEffect(() => {
    if (!recurly) return

    payPal.current = recurly.PayPal({
      display: { displayName: planName },
    })

    payPal.current.on('token', token => {
      completeSubscription(null, token)
    })
    payPal.current.on('error', err => {
      completeSubscription(err)
    })
    payPal.current.on('cancel', () => {
      setIsProcessing(false)
    })

    const payPalCopy = payPal.current

    return () => {
      payPalCopy.destroy()
    }
  }, [completeSubscription, planName])

  const handleCardChange = useCallback((state: CardElementChangeState) => {
    setCardIsValid(state.valid)
  }, [])

  if (currencyCode === 'INR' && paymentMethod !== 'credit_card') {
    setPaymentMethod('credit_card')
  }

  if (recurlyLoadError) {
    return (
      <Alert bsStyle="danger">
        <strong>{t('payment_provider_unreachable_error')}</strong>
      </Alert>
    )
  }

  const handleThreeDToken = (token: TokenPayload) => {
    // on SCA verification success: show payment UI in processing mode and
    // resubmit the payment with the new token final success or error will be
    // handled by `completeSubscription`
    completeSubscription(null, undefined, token)
    setGenericError('')
    setThreeDSecureActionTokenId(undefined)
    setIsProcessing(true)
  }

  const handleThreeDError = (error: RecurlyError) => {
    // on SCA verification error: show payment UI with the error message
    setGenericError(`Error: ${error.message}`)
    setThreeDSecureActionTokenId(undefined)
  }

  const handlePaymentMethod = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentMethod(e.target.value)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    name: keyof PricingFormState
  ) => {
    setPricingFormState(s => ({ ...s, [name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!recurly || !elements.current) return

    setIsProcessing(true)

    if (isPayPalPaymentMethod) {
      payPal.current?.start()
      return
    }

    const {
      company: _1,
      vat_number: _2,
      ...tokenDataWithoutCompanyDetails
    } = pricingFormState

    const tokenData = isAddCompanyDetailsChecked
      ? { ...pricingFormState }
      : tokenDataWithoutCompanyDetails

    recurly.token(elements.current, tokenData, completeSubscription)
  }

  const handleFormValidation = () => {
    setFormIsValid(Boolean(formRef.current?.checkValidity()))
  }

  const isFormValid = (): boolean => {
    if (isPayPalPaymentMethod) {
      return pricingFormState.country !== ''
    } else {
      return Boolean(formIsValid && cardIsValid)
    }
  }

  return (
    <>
      {threeDSecureActionTokenId && (
        <ThreeDSecure
          actionTokenId={threeDSecureActionTokenId}
          onToken={handleThreeDToken}
          onError={handleThreeDError}
        />
      )}
      <div className={classnames({ hidden: threeDSecureActionTokenId })}>
        <PriceSwitchHeader
          planCode={planCode}
          planCodes={[
            'student-annual',
            'student-monthly',
            'student_free_trial_7_days',
          ]}
        />
        <form
          noValidate
          onSubmit={handleSubmit}
          onChange={handleFormValidation}
          ref={formRef}
          data-testid="checkout-form"
        >
          {genericError && (
            <Alert bsStyle="warning" className="small">
              <strong>{genericError}</strong>
            </Alert>
          )}
          {couponError && (
            <Alert bsStyle="warning" className="small">
              <strong>{couponError}</strong>
            </Alert>
          )}
          {currencyCode === 'INR' ? null : (
            <PaymentMethodToggle
              onChange={handlePaymentMethod}
              paymentMethod={paymentMethod}
            />
          )}
          {elements.current && (
            <CardElement
              className={classnames({ hidden: !isCreditCardPaymentMethod })}
              elements={elements.current}
              onChange={handleCardChange}
            />
          )}
          {isCreditCardPaymentMethod && (
            <Row>
              <Col xs={6}>
                <FirstName
                  errorFields={errorFields}
                  value={pricingFormState.first_name}
                  onChange={e => handleChange(e, 'first_name')}
                />
              </Col>
              <Col xs={6}>
                <LastName
                  errorFields={errorFields}
                  value={pricingFormState.last_name}
                  onChange={e => handleChange(e, 'last_name')}
                />
              </Col>
            </Row>
          )}
          <AddressFirstLine
            errorFields={errorFields}
            value={pricingFormState.address1}
            onChange={e => handleChange(e, 'address1')}
          />
          <AddressSecondLine
            errorFields={errorFields}
            value={pricingFormState.address2}
            onChange={e => handleChange(e, 'address2')}
          />
          <Row>
            <Col xs={4}>
              <PostalCode
                errorFields={errorFields}
                value={pricingFormState.postal_code}
                onChange={e => handleChange(e, 'postal_code')}
              />
            </Col>
            <Col xs={8}>
              <CountrySelect
                errorFields={errorFields}
                value={pricingFormState.country}
                onChange={e => handleChange(e, 'country')}
              />
            </Col>
          </Row>
          <CompanyDetails taxesCount={taxes.length} />
          {showCouponField && (
            <CouponCode
              value={pricingFormState.coupon}
              onChange={e => handleChange(e, 'coupon')}
            />
          )}
          {isPayPalPaymentMethod &&
            t('proceeding_to_paypal_takes_you_to_the_paypal_site_to_pay')}
          <hr className="thin" />
          <div className="payment-submit">
            <SubmitButton
              isProcessing={isProcessing}
              isFormValid={isFormValid()}
            >
              {isCreditCardPaymentMethod &&
                (trialLength ? t('upgrade_cc_btn') : t('upgrade_now'))}
              {isPayPalPaymentMethod && t('proceed_to_paypal')}
            </SubmitButton>
          </div>
          <TosAgreementNotice />
        </form>
      </div>
    </>
  )
}

export default CheckoutPanel
