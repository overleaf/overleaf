import { useTranslation } from 'react-i18next'
import type { ProjectCompiler } from '../../../../../../types/project-settings'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsCompiler() {
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const { compiler, setCompiler } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect<ProjectCompiler>
      onChange={setCompiler}
      value={compiler}
      disabled={!write}
      options={[
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
      ]}
      label={t('compiler')}
      name="compiler"
    />
  )
}
