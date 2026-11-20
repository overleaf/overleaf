import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

export default function ConfirmRemoveModal({
  names,
  busy,
  onCancel,
  onConfirm,
}: {
  names: string[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()

  return (
    <OLModal
      show={names.length > 0}
      onHide={onCancel}
      id="package-hub-confirm-remove-modal"
    >
      <OLModalHeader>
        <OLModalTitle>{t('package_hub_confirm_remove_title')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p className="mb-2">
          {t('package_hub_confirm_remove_body', {
            names: names.join(', '),
          })}
        </p>
        <div className="d-flex flex-wrap gap-1">
          {names.map(name => (
            <code key={name} className="px-2 py-1 border rounded">
              {name}
            </code>
          ))}
        </div>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="danger"
          onClick={onConfirm}
          isLoading={busy}
          leadingIcon="delete"
        >
          {t('package_hub_action_remove')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
