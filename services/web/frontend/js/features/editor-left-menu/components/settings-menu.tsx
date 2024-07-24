import { Form } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import SettingsAutoCloseBrackets from './settings/settings-auto-close-brackets'
import SettingsAutoComplete from './settings/settings-auto-complete'
import SettingsCompiler from './settings/settings-compiler'
import SettingsDictionary from './settings/settings-dictionary'
import SettingsDocument from './settings/settings-document'
import SettingsEditorTheme from './settings/settings-editor-theme'
import SettingsFontFamily from './settings/settings-font-family'
import SettingsFontSize from './settings/settings-font-size'
import SettingsImageName from './settings/settings-image-name'
import SettingsKeybindings from './settings/settings-keybindings'
import SettingsLineHeight from './settings/settings-line-height'
import SettingsOverallTheme from './settings/settings-overall-theme'
import SettingsPdfViewer from './settings/settings-pdf-viewer'
import SettingsSpellCheckLanguage from './settings/settings-spell-check-language'
import SettingsSyntaxValidation from './settings/settings-syntax-validation'
import SettingsMathPreview from './settings/settings-math-preview'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export default function SettingsMenu() {
  const { t } = useTranslation()
  const anonymous = getMeta('ol-anonymous')
  const enableMathPreview = useFeatureFlag('math-preview')

  if (anonymous) {
    return null
  }

  return (
    <>
      <h4>{t('settings')}</h4>
      <Form className="settings">
        <SettingsCompiler />
        <SettingsImageName />
        <SettingsDocument />
        <SettingsSpellCheckLanguage />
        <SettingsDictionary />
        <SettingsAutoComplete />
        <SettingsAutoCloseBrackets />
        <SettingsSyntaxValidation />
        {enableMathPreview && <SettingsMathPreview />}
        <SettingsEditorTheme />
        <SettingsOverallTheme />
        <SettingsKeybindings />
        <SettingsFontSize />
        <SettingsFontFamily />
        <SettingsLineHeight />
        <SettingsPdfViewer />
      </Form>
    </>
  )
}
