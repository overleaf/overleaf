import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'
import { useSwitchEnableNewEditorState } from '@/features/ide-redesign/hooks/use-switch-enable-new-editor-state'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCallback } from 'react'
import {
  canUseNewEditor,
  useIsNewEditorEnabled,
} from '@/features/ide-redesign/utils/new-editor-utils'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

export default function SettingsNewEditor() {
  const { t } = useTranslation()
  const { setEditorRedesignStatus } = useSwitchEnableNewEditorState()
  const { setLeftMenuShown } = useLayoutContext()
  const enabled = useIsNewEditorEnabled()
  const show = canUseNewEditor()
  const { sendEvent } = useEditorAnalytics()

  const onChange = useCallback(
    (newValue: boolean) => {
      sendEvent('switch-to-new-editor', {
        location: 'left-menu',
      })
      setEditorRedesignStatus(newValue).then(() => setLeftMenuShown(false))
    },
    [setEditorRedesignStatus, setLeftMenuShown, sendEvent]
  )

  if (!show) {
    return null
  }

  return (
    <SettingsMenuSelect
      onChange={onChange}
      value={enabled}
      options={[
        {
          value: true,
          label: t('on'),
        },
        {
          value: false,
          label: t('off'),
        },
      ]}
      label={t('new_editor_look')}
      name="new-editor-setting"
    />
  )
}
