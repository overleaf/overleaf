import OLModal, {
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import { SettingsEntry, SettingsModalBody } from './settings-modal-body'

import AppearanceSettings from './appearance-settings/appearance-settings'
import CompilerSettings from './compiler-settings/compiler-settings'
import EditorSettings from './editor-settings/editor-settings'
import { useMemo, useState } from 'react'

const SettingsModal = () => {
  // TODO ide-redesign-cleanup: Either rename the field, or introduce a separate
  // one
  const { leftMenuShown, setLeftMenuShown } = useLayoutContext()
  const { t } = useTranslation()
  const settingsTabs: SettingsEntry[] = useMemo(
    () => [
      {
        key: 'editor',
        title: t('editor'),
        icon: 'code',
        component: <EditorSettings />,
      },
      {
        key: 'compiler',
        title: t('compiler'),
        icon: 'picture_as_pdf',
        component: <CompilerSettings />,
      },
      {
        key: 'appearance',
        title: t('appearance'),
        icon: 'brush',
        component: <AppearanceSettings />,
      },
      {
        key: 'account_settings',
        title: t('account_settings'),
        icon: 'settings',
        href: '/user/settings',
      },
      {
        key: 'subscription',
        title: t('subscription'),
        icon: 'account_balance',
        href: '/user/subscription',
      },
    ],
    [t]
  )
  const [activeTab, setActiveTab] = useState<string | null | undefined>(
    settingsTabs[0]?.key
  )
  return (
    <OLModal
      show={leftMenuShown}
      onHide={() => setLeftMenuShown(false)}
      size="lg"
      backdropClassName={
        activeTab === 'appearance'
          ? 'ide-settings-modal-transparent-backdrop'
          : undefined
      }
    >
      <OLModalHeader closeButton>
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

export default SettingsModal
