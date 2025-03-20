import SettingsSection from '../settings-section'
import AutoCompileSetting from './auto-compile-setting'
import CompilerSetting from './compiler-setting'
import DraftSetting from './draft-setting'
import ImageNameSetting from './image-name-setting'
import RootDocumentSetting from './root-document-setting'
import StopOnFirstErrorSetting from './stop-on-first-error-setting'

export default function CompilerSettings() {
  return (
    <>
      <SettingsSection>
        <RootDocumentSetting />
        <CompilerSetting />
        <ImageNameSetting />
        <DraftSetting />
        <StopOnFirstErrorSetting />
        <AutoCompileSetting />
      </SettingsSection>
    </>
  )
}
