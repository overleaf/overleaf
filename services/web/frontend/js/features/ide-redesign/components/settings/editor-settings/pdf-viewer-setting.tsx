import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useTranslation } from 'react-i18next'
import DropdownSetting from '../dropdown-setting'

export default function PDFViewerSetting() {
  const { pdfViewer, setPdfViewer } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <DropdownSetting
      id="pdfViewer"
      label={t('pdf_viewer')}
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
      onChange={setPdfViewer}
      value={pdfViewer}
      translateOptions="no"
    />
  )
}
