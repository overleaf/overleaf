import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
  createContext,
} from 'react'
import { currencies, CurrencyCode, CurrencySymbol } from '../data/currency'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import * as eventTracking from '../../../infrastructure/event-tracking'
import {
  PaymentContextValue,
  PricingFormState,
} from './types/payment-context-value'
import { Plan } from '../../../../../types/subscription/plan'
import {
  RecurlyOptions,
  SubscriptionPricingStateTax,
} from 'recurly__recurly-js'
import { SubscriptionPricingInstanceCustom } from '../../../../../types/recurly/pricing/subscription'

function usePayment({ publicKey }: RecurlyOptions) {
  const { t } = useTranslation()
  const plan: Plan = getMeta('ol-plan')
  const initialCountry: PricingFormState['country'] = getMeta(
    'ol-countryCode',
    ''
  )
  const initialCouponCode: PricingFormState['coupon'] = getMeta(
    'ol-couponCode',
    ''
  )
  const initiallySelectedCurrencyCode: CurrencyCode = getMeta(
    'ol-recommendedCurrency'
  )
  const planCode: string = getMeta('ol-planCode')

  const [planName, setPlanName] = useState(plan.name)
  const [recurlyLoading, setRecurlyLoading] = useState(true)
  const [recurlyLoadError, setRecurlyLoadError] = useState(false)
  const [recurlyPrice, setRecurlyPrice] = useState<{
    subtotal: string
    plan: string
    addons: string
    setup_fee: string
    discount: string
    tax: string
    total: string
  }>()
  const [monthlyBilling, setMonthlyBilling] = useState<boolean>()
  const [taxes, setTaxes] = useState<SubscriptionPricingStateTax[]>([])
  const [coupon, setCoupon] = useState<{
    discountMonths?: number
    discountRate?: number
    singleUse: boolean
    normalPrice: number
    name: string
    normalPriceWithoutTax: number
  }>()
  const [couponError, setCouponError] = useState('')
  const [trialLength, setTrialLength] = useState<number>()
  const [currencyCode, setCurrencyCode] = useState(
    initiallySelectedCurrencyCode
  )
  const [pricingFormState, setPricingFormState] = useState<PricingFormState>({
    first_name: '',
    last_name: '',
    postal_code: '',
    address1: '',
    address2: '',
    state: '',
    city: '',
    company: '',
    vat_number: '',
    country: initialCountry,
    coupon: initialCouponCode,
  })
  const pricing = useRef<SubscriptionPricingInstanceCustom>()

  const limitedCurrencyCodes = Array.from(
    new Set<CurrencyCode>([initiallySelectedCurrencyCode, 'USD', 'EUR', 'GBP'])
  )
  const limitedCurrencies = limitedCurrencyCodes.reduce((prev, cur) => {
    return { ...prev, [cur]: currencies[cur] }
  }, {} as Partial<typeof currencies>)
  const currencySymbol = limitedCurrencies[currencyCode] as CurrencySymbol

  useLayoutEffect(() => {
    if (typeof recurly === 'undefined' || !recurly) {
      setRecurlyLoadError(true)
      return
    }

    eventTracking.sendMB('payment-page-view', {
      plan: planCode,
      currency: currencyCode,
    })
    eventTracking.send(
      'subscription-funnel',
      'subscription-form-viewed',
      planCode
    )

    recurly.configure({ publicKey })
    pricing.current =
      recurly.Pricing.Subscription() as SubscriptionPricingInstanceCustom

    const setupPricing = () => {
      setRecurlyLoading(true)

      pricing.current
        ?.plan(planCode, { quantity: 1 })
        .address({
          first_name: '',
          last_name: '',
          country: initialCountry,
        })
        .tax({ tax_code: 'digital', vat_number: '' })
        .currency(currencyCode)
        .coupon(initialCouponCode)
        .catch(function (err) {
          if (currencyCode !== 'USD' && err.name === 'invalid-currency') {
            setCurrencyCode('USD')
            setupPricing()
          } else if (err.name === 'api-error' && err.code === 'not-found') {
            // not-found here should refer to the coupon code, plan_code should be valid
            setCouponError(t('coupon_code_is_not_valid_for_selected_plan'))
          } else {
            // Bail out on other errors, form state will not be correct
            setRecurlyLoadError(true)
            throw err
          }
        })
        .done(() => {
          setRecurlyLoading(false)
        })
    }

    setupPricing()
  }, [
    initialCountry,
    initialCouponCode,
    initiallySelectedCurrencyCode,
    planCode,
    publicKey,
    currencyCode,
    t,
  ])

  useEffect(() => {
    pricing.current?.on('change', function () {
      if (!pricing.current) return

      const planName = pricing.current.items.plan?.name
      if (planName) {
        setPlanName(planName)
      }

      const trialLength = pricing.current.items.plan?.trial?.length
      setTrialLength(trialLength)

      const recurlyPrice = trialLength
        ? pricing.current.price.next
        : pricing.current.price.now
      setRecurlyPrice(recurlyPrice)

      const monthlyBilling = pricing.current.items.plan?.period.length === 1
      setMonthlyBilling(monthlyBilling)

      setTaxes(pricing.current.price.taxes)

      const couponData = (() => {
        if (pricing.current.items.coupon?.discount.type === 'percent') {
          const coupon = pricing.current.items.coupon
          const basePrice = parseInt(pricing.current.price.base.plan.unit, 10)
          const discountData =
            coupon.applies_for_months > 0 && coupon.discount.rate
              ? {
                  discountMonths: coupon.applies_for_months,
                  discountRate: coupon.discount.rate * 100,
                }
              : {}

          const couponData = {
            singleUse: coupon.single_use,
            normalPrice: basePrice,
            name: coupon.name,
            normalPriceWithoutTax: basePrice,
            ...discountData,
          }

          if (pricing.current.price.taxes[0]?.rate) {
            couponData.normalPrice +=
              basePrice * parseFloat(pricing.current.price.taxes[0].rate)
          }

          return couponData
        }
      })()
      setCoupon(couponData)
    })
  }, [currencyCode])

  const addCoupon = useCallback(
    (coupon: PricingFormState['coupon']) => {
      setRecurlyLoading(true)
      setCouponError('')

      pricing.current
        ?.coupon(coupon)
        .catch(function (err) {
          if (err.name === 'api-error' && err.code === 'not-found') {
            setCouponError(t('coupon_code_is_not_valid_for_selected_plan'))
          } else {
            setCouponError(
              t('an_error_occurred_when_verifying_the_coupon_code')
            )
            throw err
          }
        })
        .done(() => {
          setRecurlyLoading(false)
        })
    },
    [t]
  )

  const updateCountry = useCallback(
    (country: PricingFormState['country']) => {
      setRecurlyLoading(true)

      pricing.current
        ?.address({
          country,
          first_name: pricingFormState.first_name,
          last_name: pricingFormState.last_name,
        })
        .done(() => {
          setRecurlyLoading(false)
        })
    },
    [pricingFormState.first_name, pricingFormState.last_name]
  )

  const applyVatNumber = useCallback(
    (vatNumber: PricingFormState['vat_number']) => {
      setRecurlyLoading(true)

      pricing.current
        ?.tax({ tax_code: 'digital', vat_number: vatNumber })
        .done(() => {
          setRecurlyLoading(false)
        })
    },
    []
  )

  const changeCurrency = useCallback(
    (newCurrency: CurrencyCode) => {
      setRecurlyLoading(true)
      setCurrencyCode(newCurrency)

      pricing.current
        ?.currency(newCurrency)
        .catch(function (err) {
          if (currencyCode !== 'USD' && err.name === 'invalid-currency') {
            setCurrencyCode('USD')
          } else {
            throw err
          }
        })
        .done(() => {
          setRecurlyLoading(false)
        })
    },
    [currencyCode]
  )

  const value = useMemo<PaymentContextValue>(
    () => ({
      currencyCode,
      setCurrencyCode,
      currencySymbol,
      limitedCurrencies,
      pricingFormState,
      setPricingFormState,
      plan,
      planCode,
      planName,
      pricing,
      recurlyLoading,
      recurlyLoadError,
      recurlyPrice,
      monthlyBilling,
      taxes,
      coupon,
      couponError,
      trialLength,
      addCoupon,
      applyVatNumber,
      changeCurrency,
      updateCountry,
    }),
    [
      currencyCode,
      setCurrencyCode,
      currencySymbol,
      limitedCurrencies,
      pricingFormState,
      setPricingFormState,
      plan,
      planCode,
      planName,
      pricing,
      recurlyLoading,
      recurlyLoadError,
      recurlyPrice,
      monthlyBilling,
      taxes,
      coupon,
      couponError,
      trialLength,
      addCoupon,
      applyVatNumber,
      changeCurrency,
      updateCountry,
    ]
  )

  return { value }
}

export const PaymentContext = createContext<PaymentContextValue | undefined>(
  undefined
)

type PaymentProviderProps = {
  publicKey: string
  children?: React.ReactNode
}

export function PaymentProvider({ publicKey, ...props }: PaymentProviderProps) {
  const { value } = usePayment({ publicKey })

  return <PaymentContext.Provider value={value} {...props} />
}

export function usePaymentContext() {
  const context = useContext(PaymentContext)
  if (!context) {
    throw new Error('PaymentContext is only available inside PaymentProvider')
  }
  return context
}
