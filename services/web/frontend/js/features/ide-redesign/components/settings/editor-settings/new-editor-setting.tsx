import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'
import { useSwitchEnableNewEditorState } from '@/features/ide-redesign/hooks/use-switch-enable-new-editor-state'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { useCallback } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'

export default function NewEditorSetting() {
  const { t } = useTranslation()
  const { setEditorRedesignStatus } = useSwitchEnableNewEditorState()
  const { setLeftMenuShown } = useLayoutContext()
  const enabled = useIsNewEditorEnabled()
  const handleToggle = useCallback(() => {
    setEditorRedesignStatus(!enabled).then(() => setLeftMenuShown(false))
  }, [enabled, setEditorRedesignStatus, setLeftMenuShown])

  return (
    <ToggleSetting
      id="new-editor-setting"
      label={
        <div className="ide-setting-new-editor">
          {t('new_editor_experience')}
          <div className="ide-setting-beta-tag">{t('beta')}</div>
        </div>
      }
      description={t('new_editor_info')}
      checked={enabled}
      onChange={handleToggle}
    />
  )
}
