import { useTranslation } from 'react-i18next'
import type { ProjectCompiler } from '../../../../../../types/project-settings'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import { useEffect, useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { Nullable } from '../../../../../../types/utils'

export default function SettingsTypstVersion() {
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const { typstVersion, setTypstVersion } = useProjectSettingsContext()
  const { projectId } = useProjectContext()
  const [typstVersions, setTypstVersions] = useState<Nullable<{ versions: [any] }>>(null);

  useEffect(() => {
    if (!typstVersions) {
      fetch(`/project/${projectId}/typst-versions`)
        .then((resp) => resp.json())
        .then((data) => setTypstVersions(data))
    }
  }, [typstVersions]);

  return (
    <SettingsMenuSelect
      onChange={setTypstVersion}
      value={typstVersion}
      disabled={!write}
      options={typstVersions?.versions ?? [{ value: "default", label: "Default" }]}
      label={t('typstVersion')}
      name="typstVersion"
      translateOptions="no"
    />
  )
}
