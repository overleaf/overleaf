import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../../../../../types/subscription/dashboard/subscription'
import { PriceForDisplayData } from '../../../../../../../../../../types/subscription/plan'
import { postJSON } from '../../../../../../../../infrastructure/fetch-json'
import getMeta from '../../../../../../../../utils/meta'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import GenericErrorAlert from '../../../../generic-error-alert'
import { subscriptionUpdateUrl } from '../../../../../../data/subscription-url'
import { getRecurlyGroupPlanCode } from '../../../../../../util/recurly-group-plan-code'
import { useLocation } from '../../../../../../../../shared/hooks/use-location'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLFormSelect from '@/features/ui/components/ol/ol-form-select'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'
import OLFormCheckbox from '@/features/ui/components/ol/ol-form-checkbox'
import { useContactUsModal } from '@/shared/hooks/use-contact-us-modal'
import { UserProvider } from '@/shared/context/user-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import { bsVersion } from '@/features/utils/bootstrap-5'

const educationalPercentDiscount = 40

function GroupPlanCollaboratorCount({ planCode }: { planCode: string }) {
  const { t } = useTranslation()

  if (planCode === 'collaborator') {
    return (
      <>
        {t('collabs_per_proj', {
          collabcount: 10,
        })}
      </>
    )
  } else if (planCode === 'professional') {
    return <>{t('unlimited_collabs')}</>
  }
  return null
}

function GroupPrice({
  groupPlanToChangeToPrice,
  queryingGroupPlanToChangeToPrice,
}: {
  groupPlanToChangeToPrice?: PriceForDisplayData
  queryingGroupPlanToChangeToPrice: boolean
}) {
  const { t } = useTranslation()

  const totalPrice =
    !queryingGroupPlanToChangeToPrice &&
    groupPlanToChangeToPrice?.totalForDisplay
      ? groupPlanToChangeToPrice.totalForDisplay
      : '…'

  const perUserPrice =
    !queryingGroupPlanToChangeToPrice &&
    groupPlanToChangeToPrice?.perUserDisplayPrice
      ? groupPlanToChangeToPrice.perUserDisplayPrice
      : '…'

  return (
    <>
      <span aria-hidden>
        {totalPrice} <span className="small">/ {t('year')}</span>
      </span>
      <span className="sr-only">
        {queryingGroupPlanToChangeToPrice
          ? t('loading_prices')
          : t('x_price_per_year', {
              price: groupPlanToChangeToPrice?.totalForDisplay,
            })}
      </span>

      <BootstrapVersionSwitcher bs3={<br />} />

      <span className="circle-subtext">
        <span aria-hidden>
          {t('x_price_per_user', {
            price: perUserPrice,
          })}
        </span>
        <span className="sr-only">
          {queryingGroupPlanToChangeToPrice
            ? t('loading_prices')
            : t('x_price_per_user', {
                price: perUserPrice,
              })}
        </span>
      </span>
    </>
  )
}

export function ChangeToGroupModal() {
  const modalId = 'change-to-group'
  const { t } = useTranslation()
  const {
    groupPlanToChangeToCode,
    groupPlanToChangeToPrice,
    groupPlanToChangeToPriceError,
    groupPlanToChangeToSize,
    groupPlanToChangeToUsage,
    handleCloseModal,
    modalIdShown,
    queryingGroupPlanToChangeToPrice,
    setGroupPlanToChangeToCode,
    setGroupPlanToChangeToSize,
    setGroupPlanToChangeToUsage,
  } = useSubscriptionDashboardContext()
  const { modal: contactModal, showModal: showContactModal } =
    useContactUsModal({ autofillProjectUrl: false })
  const groupPlans = getMeta('ol-groupPlans')
  const personalSubscription = getMeta('ol-subscription') as RecurlySubscription
  const [error, setError] = useState(false)
  const [inflight, setInflight] = useState(false)
  const location = useLocation()

  async function upgrade() {
    setError(false)
    setInflight(true)

    try {
      await postJSON(subscriptionUpdateUrl, {
        body: {
          plan_code: getRecurlyGroupPlanCode(
            groupPlanToChangeToCode,
            groupPlanToChangeToSize,
            groupPlanToChangeToUsage
          ),
        },
      })
      location.reload()
    } catch (e) {
      setError(true)
      setInflight(false)
    }
  }

  useEffect(() => {
    if (personalSubscription.plan.planCode.includes('professional')) {
      setGroupPlanToChangeToCode('professional')
    }
  }, [personalSubscription, setGroupPlanToChangeToCode])

  if (
    modalIdShown !== modalId ||
    !groupPlans ||
    !groupPlans.plans ||
    !groupPlans.sizes ||
    !groupPlans.sizesForHighDenominationCurrencies ||
    !groupPlanToChangeToCode
  )
    return null

  const isUsingCOP = personalSubscription.recurly?.currency === 'COP'
  const groupPlanSizes = isUsingCOP
    ? groupPlans.sizesForHighDenominationCurrencies
    : groupPlans.sizes

  return (
    <>
      <UserProvider>{contactModal}</UserProvider>
      <OLModal
        id={modalId}
        show
        animation
        onHide={handleCloseModal}
        backdrop="static"
      >
        <OLModalHeader closeButton>
          <OLModalTitle className="lh-sm">
            {t('customize_your_group_subscription')}
          </OLModalTitle>
        </OLModalHeader>

        <OLModalBody>
          <div className="container-fluid plans group-subscription-modal">
            {groupPlanToChangeToPriceError && <GenericErrorAlert />}
            <div className="row">
              <div className="col-md-6 text-center">
                <div className="circle circle-lg mb-4 mx-auto">
                  <GroupPrice
                    groupPlanToChangeToPrice={groupPlanToChangeToPrice}
                    queryingGroupPlanToChangeToPrice={
                      queryingGroupPlanToChangeToPrice
                    }
                  />
                </div>
                <p>{t('each_user_will_have_access_to')}:</p>
                <ul className="list-unstyled">
                  <li className="mb-3">
                    <strong>
                      <GroupPlanCollaboratorCount
                        planCode={groupPlanToChangeToCode}
                      />
                    </strong>
                  </li>
                  <li>
                    <strong>{t('all_premium_features')}</strong>
                  </li>
                  <li>{t('sync_dropbox_github')}</li>
                  <li>{t('full_doc_history')}</li>
                  <li>{t('track_changes')}</li>
                  <li>
                    <span aria-hidden>+ {t('more').toLowerCase()}</span>
                    <span className="sr-only">{t('plus_more')}</span>
                  </li>
                </ul>
              </div>

              <div className="col-md-6">
                <form className="form">
                  <fieldset className="form-group">
                    <legend className="legend-as-label">{t('plan')}</legend>
                    {groupPlans.plans.map(option => (
                      <div
                        className={bsVersion({ bs3: 'radio' })}
                        key={option.code}
                      >
                        <OLFormCheckbox
                          type="radio"
                          name="plan-code"
                          value={option.code}
                          id={`plan-option-${option.code}`}
                          onChange={() =>
                            setGroupPlanToChangeToCode(option.code)
                          }
                          checked={option.code === groupPlanToChangeToCode}
                          label={option.display}
                        />
                      </div>
                    ))}
                  </fieldset>

                  <OLFormGroup controlId="size">
                    <OLFormLabel>{t('number_of_users')}</OLFormLabel>
                    <OLFormSelect
                      name="size"
                      value={groupPlanToChangeToSize}
                      onChange={e => setGroupPlanToChangeToSize(e.target.value)}
                    >
                      {groupPlanSizes.map(size => (
                        <option key={`size-option-${size}`}>{size}</option>
                      ))}
                    </OLFormSelect>
                  </OLFormGroup>

                  <OLFormCheckbox
                    id="usage"
                    type="checkbox"
                    autoComplete="off"
                    checked={groupPlanToChangeToUsage === 'educational'}
                    onChange={e => {
                      if (e.target.checked) {
                        setGroupPlanToChangeToUsage('educational')
                      } else {
                        setGroupPlanToChangeToUsage('enterprise')
                      }
                    }}
                    label={
                      <Trans
                        i18nKey="license_for_educational_purposes_confirmation"
                        values={{ percent: educationalPercentDiscount }}
                        shouldUnescape
                        tOptions={{ interpolation: { escapeValue: true } }}
                        components={[
                          /* eslint-disable-next-line react/jsx-key */
                          <strong />,
                          /* eslint-disable-next-line react/jsx-key */
                          <br />,
                        ]}
                      />
                    }
                  />
                </form>
              </div>
            </div>
            <div className="educational-discount-badge pt-4 text-center">
              {groupPlanToChangeToUsage === 'educational' && (
                <p className="applied">
                  {t('educational_percent_discount_applied', {
                    percent: educationalPercentDiscount,
                  })}
                </p>
              )}
            </div>
          </div>
        </OLModalBody>

        <OLModalFooter>
          <div className="text-center">
            {groupPlanToChangeToPrice?.includesTax && (
              <p>
                <Trans
                  i18nKey="total_with_subtotal_and_tax"
                  values={{
                    total: groupPlanToChangeToPrice.totalForDisplay,
                    subtotal: groupPlanToChangeToPrice.subtotal,
                    tax: groupPlanToChangeToPrice.tax,
                  }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                  components={[
                    /* eslint-disable-next-line react/jsx-key */
                    <strong />,
                  ]}
                />
              </p>
            )}
            <p>
              <strong>
                {t('new_subscription_will_be_billed_immediately')}
              </strong>
            </p>
            <hr className="thin my-3" />
            {error && (
              <OLNotification
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
            <OLButton
              variant="primary"
              size="lg"
              disabled={
                queryingGroupPlanToChangeToPrice ||
                !groupPlanToChangeToPrice ||
                inflight
              }
              onClick={upgrade}
              isLoading={inflight}
              bs3Props={{
                loading: inflight
                  ? t('processing_uppercase') + '…'
                  : t('upgrade_now'),
              }}
            >
              {t('upgrade_now')}
            </OLButton>
            <hr className="thin my-3" />
            <OLButton
              variant="link"
              className="btn-inline-link"
              onClick={showContactModal}
            >
              {t('need_more_than_x_licenses', {
                x: isUsingCOP ? 20 : 50,
              })}{' '}
              {t('please_get_in_touch')}
            </OLButton>
          </div>
        </OLModalFooter>
      </OLModal>
    </>
  )
}
