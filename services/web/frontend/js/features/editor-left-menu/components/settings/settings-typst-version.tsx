import { useTranslation } from 'react-i18next'
import type { ProjectCompiler } from '../../../../../../types/project-settings'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsTypstVersion() {
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const { typstVersion, setTypstVersion } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect
      onChange={setTypstVersion}
      value={typstVersion}
      disabled={!write}
      options={[
        {
          value: 'v0.13.1',
          label: 'v0.13.1',
        },
        {
          value: 'v0.12.0',
          label: 'v0.12.0',
        },
        {
          value: 'v0.11.1',
          label: 'v0.11.1',
        },
        {
          value: 'v0.10.0',
          label: 'v0.10.0',
        },
        {
          value: 'not-exist',
          label: 'not-exist',
        },
      ]}
      label={t('typstVersion')}
      name="typstVersion"
      translateOptions="no"
    />
  )
}
