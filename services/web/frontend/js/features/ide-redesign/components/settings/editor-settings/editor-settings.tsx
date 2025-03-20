import AutoCompleteSetting from './auto-complete-setting'
import CodeCheckSetting from './code-check-setting'
import AutoCloseBracketsSetting from './auto-close-brackets-setting'
import SettingsSection from '../settings-section'
import MathPreviewSetting from './math-preview-setting'
import { useTranslation } from 'react-i18next'
import KeybindingSetting from './keybinding-setting'
import PDFViewerSetting from './pdf-viewer-setting'
import SpellCheckSetting from './spell-check-setting'
import DictionarySetting from './dictionary-setting'
import importOverleafModules from '../../../../../../macros/import-overleaf-module.macro'

const [referenceSearchSettingModule] = importOverleafModules(
  'referenceSearchSetting'
)
const ReferenceSearchSetting = referenceSearchSettingModule?.import.default

export default function EditorSettings() {
  const { t } = useTranslation()

  return (
    <>
      <SettingsSection>
        <AutoCompleteSetting />
        <AutoCloseBracketsSetting />
        <CodeCheckSetting />
        <KeybindingSetting />
        <PDFViewerSetting />
        {ReferenceSearchSetting && <ReferenceSearchSetting />}
      </SettingsSection>
      <SettingsSection title={t('spellcheck')}>
        <SpellCheckSetting />
        <DictionarySetting />
      </SettingsSection>
      <SettingsSection title={t('tools')}>
        <MathPreviewSetting />
      </SettingsSection>
    </>
  )
}
