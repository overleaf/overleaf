import EditorThemeSetting from './editor-theme-setting'
import AutoCompleteSetting from './auto-complete-setting'
import CodeCheckSetting from './code-check-setting'
import AutoCloseBracketsSetting from './auto-close-brackets-setting'
import SettingsSection from '../settings-section'
import MathPreviewSetting from './math-preview-setting'
import { useTranslation } from 'react-i18next'

export default function EditorSettings() {
  const { t } = useTranslation()

  return (
    <>
      <SettingsSection>
        <EditorThemeSetting />
        <AutoCompleteSetting />
        <AutoCloseBracketsSetting />
        <CodeCheckSetting />
      </SettingsSection>
      <SettingsSection title={t('tools')}>
        <MathPreviewSetting />
      </SettingsSection>
    </>
  )
}
