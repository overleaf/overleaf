import { useEffect } from 'react'
import { Modal } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import { GroupPlans } from '../../../../../../../../../../types/subscription/dashboard/group-plans'
import { Subscription } from '../../../../../../../../../../types/subscription/dashboard/subscription'
import AccessibleModal from '../../../../../../../../shared/components/accessible-modal'
import getMeta from '../../../../../../../../utils/meta'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'

const educationalPercentDiscount = 40
const groupSizeForEducationalDiscount = 10

function GroupPlanCollaboratorCount({ planCode }: { planCode: string }) {
  const { t } = useTranslation()

  if (planCode === 'collaborator') {
    return (
      <>
        <Trans
          i18nKey="collabs_per_proj"
          values={{
            collabcount: 10,
          }}
        />
      </>
    )
  } else if (planCode === 'professional') {
    return <>{t('unlimited_collabs')}</>
  }
  return null
}

function EducationDiscountAppliedOrNot({ groupSize }: { groupSize: string }) {
  const size = parseInt(groupSize)
  if (size >= groupSizeForEducationalDiscount) {
    return (
      <p className="applied">
        <Trans
          i18nKey="educational_percent_discount_applied"
          values={{ percent: educationalPercentDiscount }}
        />
      </p>
    )
  }

  return (
    <p className="ineligible">
      <Trans
        i18nKey="educational_discount_for_groups_of_x_or_more"
        values={{ size: groupSizeForEducationalDiscount }}
      />
    </p>
  )
}

function GroupPrice() {
  const { t } = useTranslation()
  return (
    <>
      <span aria-hidden>
        X <span className="small">/ {t('year')}</span>
      </span>
      <span className="sr-only">
        {/* TODO: price */}
        <Trans i18nKey="x_price_per_year" values={{ price: '$X' }} />
      </span>
      <br />
      <span className="circle-subtext">
        {/* TODO: price */}
        <Trans i18nKey="x_price_per_user" values={{ price: '$X' }} />
      </span>
    </>
  )
}

export function ChangeToGroupModal() {
  const modalId = 'change-to-group'
  const { t } = useTranslation()
  const {
    groupPlanToChangeToCode,
    groupPlanToChangeToSize,
    groupPlanToChangeToUsage,
    handleCloseModal,
    modalIdShown,
    setGroupPlanToChangeToCode,
    setGroupPlanToChangeToSize,
    setGroupPlanToChangeToUsage,
  } = useSubscriptionDashboardContext()
  const groupPlans: GroupPlans = getMeta('ol-groupPlans')
  const personalSubscription: Subscription = getMeta('ol-subscription')

  useEffect(() => {
    const defaultPlanOption = personalSubscription.plan.planCode.includes(
      'professional'
    )
      ? 'professional'
      : 'collaborator'
    setGroupPlanToChangeToCode(defaultPlanOption)
  }, [personalSubscription, setGroupPlanToChangeToCode])

  if (
    modalIdShown !== modalId ||
    !groupPlans ||
    !groupPlans.plans ||
    !groupPlans.sizes ||
    !groupPlanToChangeToCode
  )
    return null

  return (
    <AccessibleModal
      id={modalId}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <Modal.Header>
        <button className="close" onClick={handleCloseModal}>
          <span aria-hidden="true">×</span>
          <span className="sr-only">{t('close')}</span>
        </button>
        <div className="modal-title">
          <h2>{t('customize_your_group_subscription')}</h2>
          <h3>
            <Trans
              i18nKey="save_x_percent_or_more"
              values={{
                percent: '30',
              }}
            />
          </h3>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="container-fluid plans group-subscription-modal">
          <div className="row">
            <div className="col-md-6 text-center">
              <div className="circle circle-lg">
                <GroupPrice />
              </div>
              <p>{t('each_user_will_have_access_to')}:</p>
              <ul className="list-unstyled">
                <li className="list-item-with-margin-bottom">
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
                    <label
                      htmlFor={`plan-option-${option.code}`}
                      key={option.code}
                      className="group-plan-option"
                    >
                      <input
                        type="radio"
                        name="plan-code"
                        value={option.code}
                        id={`plan-option-${option.code}`}
                        onChange={e =>
                          setGroupPlanToChangeToCode(e.target.value)
                        }
                        checked={option.code === groupPlanToChangeToCode}
                      />
                      <span>{option.display}</span>
                    </label>
                  ))}
                </fieldset>

                <div className="form-group">
                  <label htmlFor="size">{t('number_of_users')}</label>
                  <select
                    name="size"
                    id="size"
                    className="form-control"
                    value={groupPlanToChangeToSize}
                    onChange={e => setGroupPlanToChangeToSize(e.target.value)}
                  >
                    {groupPlans.sizes.map(size => (
                      <option key={`size-option-${size}`}>{size}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <strong>
                    <Trans
                      i18nKey="percent_discount_for_groups"
                      values={{
                        percent: educationalPercentDiscount,
                        size: groupSizeForEducationalDiscount,
                      }}
                    />
                  </strong>
                </div>

                <div className="form-group group-plan-option">
                  <label htmlFor="usage">
                    <input
                      id="usage"
                      type="checkbox"
                      checked={groupPlanToChangeToUsage === 'educational'}
                      onChange={e => {
                        if (e.target.checked) {
                          setGroupPlanToChangeToUsage('educational')
                        } else {
                          setGroupPlanToChangeToUsage('enterprise')
                        }
                      }}
                    />
                    <span>{t('license_for_educational_purposes')}</span>
                  </label>
                </div>
              </form>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12 text-center">
              <div className="educational-discount-badge">
                {groupPlanToChangeToUsage === 'educational' && (
                  <EducationDiscountAppliedOrNot
                    groupSize={groupPlanToChangeToSize}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="text-center">
          <p>
            <strong>{t('new_subscription_will_be_billed_immediately')}</strong>
          </p>
          <hr className="thin" />
          <button className="btn btn-primary btn-lg">{t('upgrade_now')}</button>
          <hr className="thin" />
          <button
            className="btn-inline-link"
            data-ol-open-contact-form-for-more-than-50-licenses
          >
            <Trans i18nKey="need_more_than_x_licenses" values={{ x: 50 }} />{' '}
            {t('please_get_in_touch')}
          </button>
        </div>
      </Modal.Footer>
    </AccessibleModal>
  )
}
