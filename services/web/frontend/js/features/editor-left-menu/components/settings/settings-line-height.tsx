import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import { LineHeight } from '@/shared/utils/styles'

export default function SettingsLineHeight() {
  const { t } = useTranslation()
  const { lineHeight, setLineHeight } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect<LineHeight>
      onChange={setLineHeight}
      value={lineHeight}
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
      label={t('line_height')}
      name="lineHeight"
    />
  )
}
