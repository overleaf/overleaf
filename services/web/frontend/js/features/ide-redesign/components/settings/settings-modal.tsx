import OLModal, {
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import { SettingsModalBody } from './settings-modal-body'

const SettingsModal = () => {
  // TODO ide-redesign-cleanup: Either rename the field, or introduce a separate
  // one
  const { leftMenuShown, setLeftMenuShown } = useLayoutContext()
  const { t } = useTranslation()
  return (
    <OLModal
      show={leftMenuShown}
      onHide={() => setLeftMenuShown(false)}
      size="lg"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>{t('settings')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="ide-settings-modal-body">
        <SettingsModalBody />
      </OLModalBody>
    </OLModal>
  )
}

export default SettingsModal
