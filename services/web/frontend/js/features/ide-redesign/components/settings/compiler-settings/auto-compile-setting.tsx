import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useSetCompilationSettingWithEvent } from '@/features/editor-left-menu/hooks/use-set-compilation-setting'

export default function AutoCompileSetting() {
  const { autoCompile, setAutoCompile } = useCompileContext()
  const { t } = useTranslation()
  const changeAutoCompile = useSetCompilationSettingWithEvent(
    'auto-compile',
    setAutoCompile
  )

  return (
    <ToggleSetting
      id="autoCompile"
      label={t('autocompile')}
      description={t('automatically_recompile_the_project_as_you_edit')}
      checked={autoCompile}
      onChange={changeAutoCompile}
    />
  )
}
