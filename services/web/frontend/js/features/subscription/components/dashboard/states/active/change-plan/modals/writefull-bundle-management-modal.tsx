import { useTranslation } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import sparkle from '@/shared/svgs/sparkle.svg'
import { Dropdown, DropdownMenu, DropdownToggle } from 'react-bootstrap'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
import MaterialIcon from '@/shared/components/material-icon'
import { ADD_ON_NAME } from '@/features/subscription/data/add-on-codes'
import getMeta from '@/utils/meta'

function WritefullBundleManagementModal() {
  const modalId: SubscriptionDashModalIds = 'manage-on-writefull'
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown } = useSubscriptionDashboardContext()
  const aiAssistViaWritefullSource = getMeta('ol-aiAssistViaWritefullSource')

  if (modalIdShown !== modalId) return null

  const individualWFSubscription = aiAssistViaWritefullSource === 'individual'

  return (
    <OLModal
      id={modalId}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle>{t('manage_your_ai_assist_add_on')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>
          {individualWFSubscription
            ? t('ai_assist_in_overleaf_is_included_via_writefull_individual')
            : t('ai_assist_in_overleaf_is_included_via_writefull_groups')}
        </p>
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleCloseModal}>
          {t('back')}
        </OLButton>
        {individualWFSubscription && (
          <OLButton
            variant="primary"
            onClick={handleCloseModal}
            href="https://my.writefull.com/account"
            target="_blank"
            rel="noreferrer"
          >
            {t('go_to_writefull')}
          </OLButton>
        )}
      </OLModalFooter>
    </OLModal>
  )
}

function WritefullGrantedAddOn({
  handleManageOnWritefull,
}: {
  handleManageOnWritefull: () => void
}) {
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
        <div className="heading">{ADD_ON_NAME}</div>
        <div className="description small mt-1">
          {t('included_as_part_of_your_writefull_subscription')}
        </div>
      </div>

      <div className="ms-auto">
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
            <OLDropdownMenuItem tabIndex={-1} onClick={handleManageOnWritefull}>
              {t('manage_subscription')}
            </OLDropdownMenuItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </div>
  )
}

function WritefullManagedBundleAddOn() {
  const { setModalIdShown } = useSubscriptionDashboardContext()
  const handleManageOnWritefull = () => setModalIdShown('manage-on-writefull')
  return (
    <>
      <WritefullGrantedAddOn
        handleManageOnWritefull={handleManageOnWritefull}
      />
      <WritefullBundleManagementModal />
    </>
  )
}

export default WritefullManagedBundleAddOn
