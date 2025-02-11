import { useTranslation } from 'react-i18next'
import {
  Dropdown as BS3Dropdown,
  MenuItem as BS3MenuItem,
} from 'react-bootstrap'
import { Dropdown, DropdownMenu, DropdownToggle } from 'react-bootstrap-5'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import ControlledDropdown from '@/shared/components/controlled-dropdown'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import {
  ADD_ON_NAME,
  AI_ADD_ON_CODE,
  AI_STANDALONE_ANNUAL_PLAN_CODE,
  AI_STANDALONE_PLAN_CODE,
} from '@/features/subscription/data/add-on-codes'
import sparkle from '@/shared/svgs/sparkle.svg'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { LICENSE_ADD_ON } from '@/features/group-management/components/upgrade-subscription/upgrade-subscription-plan-details'

type AddOnsProps = {
  subscription: RecurlySubscription
  onStandalonePlan: boolean
  handleCancelClick: (code: string) => void
}

type AddOnProps = {
  addOnCode: string
  displayPrice: string | undefined
  pendingCancellation: boolean
  isAnnual: boolean
  handleCancelClick: (code: string) => void
  nextBillingDate: string
}

function resolveAddOnName(addOnCode: string) {
  switch (addOnCode) {
    case AI_ADD_ON_CODE:
    case AI_STANDALONE_ANNUAL_PLAN_CODE:
    case AI_STANDALONE_PLAN_CODE:
      return ADD_ON_NAME
  }
}

function AddOn({
  addOnCode,
  displayPrice,
  pendingCancellation,
  isAnnual,
  handleCancelClick,
  nextBillingDate,
}: AddOnProps) {
  const { t } = useTranslation()
  return (
    <div className="add-on-card">
      <div>
        <img
          alt="sparkle"
          className="add-on-card-icon"
          src={sparkle}
          aria-hidden="true"
        />
      </div>
      <div className="add-on-card-content">
        <div className="heading">{resolveAddOnName(addOnCode)}</div>
        <div className="description small mt-1">
          {pendingCancellation
            ? t(
                'your_add_on_has_been_cancelled_and_will_remain_active_until_your_billing_cycle_ends_on',
                { nextBillingDate }
              )
            : isAnnual
              ? t('x_price_per_year', { price: displayPrice })
              : t('x_price_per_month', { price: displayPrice })}
        </div>
      </div>
      {!pendingCancellation && (
        <div className="ms-auto">
          <BootstrapVersionSwitcher
            bs3={
              <ControlledDropdown id="add-ons-actions" pullRight>
                <BS3Dropdown.Toggle
                  noCaret
                  bsStyle={null}
                  className="add-on-options-toggle btn-secondary"
                >
                  <MaterialIcon
                    type="more_vert"
                    accessibilityLabel={t('more_options')}
                  />
                </BS3Dropdown.Toggle>
                <BS3Dropdown.Menu>
                  <BS3MenuItem onClick={() => handleCancelClick(addOnCode)}>
                    {t('cancel')}
                  </BS3MenuItem>
                </BS3Dropdown.Menu>
              </ControlledDropdown>
            }
            bs5={
              <Dropdown align="end">
                <DropdownToggle
                  id="add-on-dropdown-toggle"
                  className="add-on-options-toggle"
                  variant="secondary"
                >
                  <MaterialIcon
                    type="more_vert"
                    accessibilityLabel={t('more_options')}
                  />
                </DropdownToggle>
                <DropdownMenu flip={false}>
                  <OLDropdownMenuItem
                    onClick={() => handleCancelClick(addOnCode)}
                    as="button"
                    tabIndex={-1}
                    variant="danger"
                  >
                    {t('cancel')}
                  </OLDropdownMenuItem>
                </DropdownMenu>
              </Dropdown>
            }
          />
        </div>
      )}
    </div>
  )
}

function AddOns({
  subscription,
  onStandalonePlan,
  handleCancelClick,
}: AddOnsProps) {
  const { t } = useTranslation()
  const addOnsDisplayPrices = onStandalonePlan
    ? {
        [AI_STANDALONE_PLAN_CODE]: subscription.recurly.displayPrice,
      }
    : subscription.recurly.addOnDisplayPricesWithoutAdditionalLicense
  const addOnsToDisplay = onStandalonePlan
    ? [{ addOnCode: AI_STANDALONE_PLAN_CODE }]
    : subscription.addOns?.filter(addOn => addOn.addOnCode !== LICENSE_ADD_ON)

  return (
    <>
      <h2 className={classnames('h3', bsVersion({ bs5: 'fw-bold' }))}>
        {t('add_ons')}
      </h2>
      {addOnsToDisplay && addOnsToDisplay.length > 0 ? (
        addOnsToDisplay.map(addOn => (
          <AddOn
            addOnCode={addOn.addOnCode}
            key={addOn.addOnCode}
            isAnnual={Boolean(subscription.plan.annual)}
            handleCancelClick={handleCancelClick}
            pendingCancellation={
              subscription.pendingPlan !== undefined &&
              (subscription.pendingPlan.addOns ?? []).every(
                pendingAddOn => pendingAddOn.addOnCode !== addOn.addOnCode
              )
            }
            displayPrice={addOnsDisplayPrices[addOn.addOnCode]}
            nextBillingDate={subscription.recurly.nextPaymentDueDate}
          />
        ))
      ) : (
        <p>{t('you_dont_have_any_add_ons_on_your_account')}</p>
      )}
    </>
  )
}

export default AddOns
