import {
  OLModal,
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { useTranslation } from 'react-i18next'
import { SettingsModalBody } from './settings-modal-body'
import {
  SettingsModalProvider,
  useSettingsModalContext,
} from '../../contexts/settings-modal-context'
import useFocusOnSetting from '../../hooks/use-focus-on-setting'

const SettingsModalWrapper = () => {
  return (
    <SettingsModalProvider>
      <SettingsModal />
    </SettingsModalProvider>
  )
}

const SettingsModal = () => {
  const { t } = useTranslation()
  const { show, setShow, settingsTabs, activeTab, setActiveTab } =
    useSettingsModalContext()

  useFocusOnSetting()

  return (
    <OLModal
      show={show}
      onHide={() => setShow(false)}
      size="lg"
      backdropClassName={
        activeTab === 'appearance'
          ? 'ide-settings-modal-transparent-backdrop'
          : undefined
      }
    >
      <OLModalHeader>
        <OLModalTitle>{t('settings')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="ide-settings-modal-body">
        <SettingsModalBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settingsTabs={settingsTabs}
        />
      </OLModalBody>
    </OLModal>
  )
}

export default SettingsModalWrapper
