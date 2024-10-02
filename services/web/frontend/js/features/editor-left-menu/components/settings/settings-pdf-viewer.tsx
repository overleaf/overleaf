import { useTranslation } from 'react-i18next'
import type { PdfViewer } from '../../../../../../types/user-settings'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsPdfViewer() {
  const { t } = useTranslation()
  const { pdfViewer, setPdfViewer } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect<PdfViewer>
      onChange={setPdfViewer}
      value={pdfViewer}
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
