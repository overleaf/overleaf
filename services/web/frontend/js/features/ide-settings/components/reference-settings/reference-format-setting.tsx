import { useTranslation } from 'react-i18next'
import DropdownSetting from '../dropdown-setting'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

export default function ReferenceFormatSetting() {
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const { referenceFormat, setReferenceFormat } = useProjectSettingsContext()

  return (
    <DropdownSetting
      id="referenceFormat"
      label={t('reference_format')}
      options={[
        {
          value: 'bibtex',
          label: t('bibtex'),
        },
        {
          value: 'biblatex',
          label: t('biblatex'),
        },
      ]}
      onChange={setReferenceFormat}
      value={referenceFormat || 'biblatex'}
      translateOptions="no"
      disabled={!write}
    />
  )
}
