import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { PendingAccessType } from '@/features/share-project-modal/components/project-access'

type RemoveSharingLinksModalProps = {
  pendingAccess: PendingAccessType
  onCancel: () => void
  onConfirm: () => void
}

function RemoveSharingLinksModal({
  pendingAccess,
  onCancel,
  onConfirm,
}: RemoveSharingLinksModalProps) {
  const { t } = useTranslation()

  let confirmationModalBodyText = null
  if (pendingAccess === 'onlyInvitedPeople') {
    confirmationModalBodyText = t(
      'this_change_will_permanently_remove_your_original_links_you_can_still_share_new_link'
    )
  } else if (
    pendingAccess.startsWith('anyoneInXyzWithTheLink') ||
    pendingAccess === 'anyoneWithTheLink'
  ) {
    confirmationModalBodyText = t(
      'this_change_will_permanently_remove_your_original_links_you_need_to_share_the_new_link'
    )
  }

  return (
    <OLModal show onHide={onCancel} size="sm" backdrop={false}>
      <OLModalHeader>
        <OLModalTitle>{t('remove_original_sharing_links')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>{confirmationModalBodyText}</OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="danger" onClick={onConfirm}>
          {t('remove_original_links')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default RemoveSharingLinksModal
