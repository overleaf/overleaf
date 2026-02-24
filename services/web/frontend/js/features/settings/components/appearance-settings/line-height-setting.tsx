import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useTranslation } from 'react-i18next'
import DropdownSetting from '../dropdown-setting'

export default function LineHeightSetting() {
  const { lineHeight, setLineHeight } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <DropdownSetting
      id="lineHeight"
      label={t('editor_line_height')}
      options={[
        {
          value: 'compact',
          label: t('compact'),
        },
        {
          value: 'normal',
          label: t('normal'),
        },
        {
          value: 'wide',
          label: t('wide'),
        },
      ]}
      onChange={setLineHeight}
      value={lineHeight}
    />
  )
}
