import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsPdfViewer() {
  const { t } = useTranslation()

  return (
    <SettingsMenuSelect
      options={[
        {
          value: 'pdfjs',
          label: t('overleaf'),
        },
        {
          value: 'native',
          label: t('browser'),
        },
      ]}
      label={t('pdf_viewer')}
      name="pdfViewer"
    />
  )
}
