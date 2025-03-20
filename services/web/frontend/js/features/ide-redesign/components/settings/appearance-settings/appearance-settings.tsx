import SettingsSection from '../settings-section'
import OverallThemeSetting from '../appearance-settings/overall-theme-setting'
import EditorThemeSetting from './editor-theme-setting'
import FontSizeSetting from './font-size-setting'
import FontFamilySetting from './font-family-setting'
import LineHeightSetting from './line-height-setting'

export default function AppearanceSettings() {
  return (
    <SettingsSection>
      <OverallThemeSetting />
      <EditorThemeSetting />
      <FontSizeSetting />
      <FontFamilySetting />
      <LineHeightSetting />
    </SettingsSection>
  )
}
