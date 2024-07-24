import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsMathPreview() {
  const { t } = useTranslation()
  const { mathPreview, setMathPreview } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect
      onChange={setMathPreview}
      value={mathPreview}
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
      label={t('equation_preview')}
      name="mathPreview"
    />
  )
}
