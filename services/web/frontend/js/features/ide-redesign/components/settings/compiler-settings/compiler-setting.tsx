import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import type { Option } from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { ProjectCompiler } from '../../../../../../../types/project-settings'

const OPTIONS: Option<ProjectCompiler>[] = [
  {
    value: 'pdflatex',
    label: 'pdfLaTeX',
  },
  {
    value: 'latex',
    label: 'LaTeX',
  },
  {
    value: 'xelatex',
    label: 'XeLaTeX',
  },
  {
    value: 'lualatex',
    label: 'LuaLaTeX',
  },
]

export default function CompilerSetting() {
  const { compiler, setCompiler } = useProjectSettingsContext()
  const { t } = useTranslation()
  const { write } = usePermissionsContext()

  return (
    <DropdownSetting
      id="compiler"
      label={t('compiler')}
      description={t('the_latex_engine_used_for_compiling')}
      disabled={!write}
      options={OPTIONS}
      onChange={setCompiler}
      value={compiler}
    />
  )
}
