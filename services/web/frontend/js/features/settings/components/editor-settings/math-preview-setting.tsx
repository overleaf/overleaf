import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function MathPreviewSetting() {
  const { mathPreview, setMathPreview } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="mathPreview"
      label={t('equation_preview')}
      description={t('show_live_equation_previews_while_typing')}
      checked={mathPreview}
      onChange={setMathPreview}
    />
  )
}
