import ToggleSetting from '../toggle-setting'
import getMeta from '../../../../utils/meta'
import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '@/features/ide-settings/context/project-settings-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useSetCompilationSettingWithEvent } from '@/features/ide-settings/hooks/use-set-compilation-setting'

export default function OptimizeCompilesSetting() {
  const { t } = useTranslation()
  const png2pdfEnabled = getMeta('ol-canUsePng2Pdf')
  const { png2pdf, setPng2pdf } = useProjectSettingsContext()
  const { write } = usePermissionsContext()
  const changePng2pdf = useSetCompilationSettingWithEvent(
    'optimize-compiles',
    setPng2pdf
  )

  return png2pdfEnabled ? (
    <ToggleSetting
      id="optimizeCompiles"
      label={t('optimise_images_recommended')}
      description={t('speed_up_compiles_by_reusing_images')}
      disabled={!write}
      checked={png2pdf}
      onChange={changePng2pdf}
    />
  ) : null
}
