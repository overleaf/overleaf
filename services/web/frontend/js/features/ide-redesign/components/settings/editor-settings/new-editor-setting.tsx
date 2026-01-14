import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'
import { useSwitchEnableNewEditorState } from '@/features/ide-redesign/hooks/use-switch-enable-new-editor-state'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { useCallback } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import getMeta from '@/utils/meta'

export default function NewEditorSetting() {
  const { isOverleaf } = getMeta('ol-ExposedSettings')
  const { t } = useTranslation()
  const { setEditorRedesignStatus } = useSwitchEnableNewEditorState()
  const { setLeftMenuShown } = useLayoutContext()
  const enabled = useIsNewEditorEnabled()
  const { sendEvent } = useEditorAnalytics()

  const handleToggle = useCallback(() => {
    sendEvent('switch-to-old-editor', { location: 'settings-modal' })
    setEditorRedesignStatus(!enabled).then(() => setLeftMenuShown(false))
  }, [enabled, setEditorRedesignStatus, setLeftMenuShown, sendEvent])

  return (
    <ToggleSetting
      id="new-editor-setting"
      label={t('new_editor_look')}
      description={
        <>
          <div>{t('the_new_overleaf_editor_info')}</div>
          {isOverleaf && (
            <a
              href="https://forms.gle/3tPYhXcBVGmUB2HXA"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('share_feedback_on_the_new_editor')}
            </a>
          )}
        </>
      }
      checked={enabled}
      onChange={handleToggle}
    />
  )
}
