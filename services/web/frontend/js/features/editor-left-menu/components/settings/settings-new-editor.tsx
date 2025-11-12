import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'
import { useSwitchEnableNewEditorState } from '@/features/ide-redesign/hooks/use-switch-enable-new-editor-state'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCallback } from 'react'
import {
  canUseNewEditorAsNewUser,
  useIsNewEditorEnabled,
} from '@/features/ide-redesign/utils/new-editor-utils'

export default function SettingsNewEditor() {
  const { t } = useTranslation()
  const { setEditorRedesignStatus } = useSwitchEnableNewEditorState()
  const { setLeftMenuShown } = useLayoutContext()
  const enabled = useIsNewEditorEnabled()
  const show = canUseNewEditorAsNewUser()

  const onChange = useCallback(
    (newValue: boolean) => {
      setEditorRedesignStatus(newValue).then(() => setLeftMenuShown(false))
    },
    [setEditorRedesignStatus, setLeftMenuShown]
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
      label={t('new_editor')}
      name="new-editor-setting"
    />
  )
}
