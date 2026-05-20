import { useState } from 'react'
import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import type { Option } from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { ProjectCompiler } from '@ol-types/project-settings'
import { useSetCompilationSettingWithEvent } from '@/features/editor-left-menu/hooks/use-set-compilation-setting'
import getMeta from '@/utils/meta'
import _ from 'lodash'

function getCompilerOptions(): Option<ProjectCompiler>[] {
  const compilerOptions = ['pdfLaTeX', 'LaTeX', 'XeLaTeX', 'LuaLaTeX']
  const defaultCompiler = getMeta('ol-defaultLatexCompiler') as ProjectCompiler
  const sortedOptions = _.sortBy(
    compilerOptions,
    option => option.toLowerCase() !== defaultCompiler.toLowerCase()
  )
  return sortedOptions.map(option => ({
    value: option.toLowerCase() as ProjectCompiler,
    label: option,
  }))
}

export default function CompilerSetting() {
  const { compiler, setCompiler } = useProjectSettingsContext()
  const [compilerOptions] = useState(() => getCompilerOptions())
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const changeCompiler = useSetCompilationSettingWithEvent(
    'compiler',
    setCompiler
  )

  return (
    <DropdownSetting
      id="compiler"
      label={t('compiler')}
      description={t('the_latex_engine_used_for_compiling')}
      disabled={!write}
      options={compilerOptions}
      onChange={changeCompiler}
      value={compiler}
      translateOptions="no"
    />
  )
}
