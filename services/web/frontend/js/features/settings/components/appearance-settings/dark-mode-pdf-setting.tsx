import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'

export default function DarkModePdfSetting() {
  const { darkModePdf, setDarkModePdf } = useCompileContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="pdf-dark-mode-setting"
      label={t('dark_mode_pdf_preview')}
      description={t('invert_pdf_preview_colors_when_in_dark_mode')}
      checked={darkModePdf}
      onChange={setDarkModePdf}
    />
  )
}
