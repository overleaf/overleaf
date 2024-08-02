import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import { useEditorContext } from '@/shared/context/editor-context'

export default function SettingsImageName() {
  const { t } = useTranslation()
  const { imageName, setImageName } = useProjectSettingsContext()
  const { permissionsLevel } = useEditorContext()

  const allowedImageNames = useMemo(
    () => getMeta('ol-allowedImageNames') || [],
    []
  )

  const options: Array<Option> = useMemo(
    () =>
      allowedImageNames.map(({ imageName, imageDesc }) => ({
        value: imageName,
        label: imageDesc,
      })),
    [allowedImageNames]
  )

  if (allowedImageNames.length === 0) {
    return null
  }

  return (
    <SettingsMenuSelect
      onChange={setImageName}
      value={imageName}
      disabled={permissionsLevel === 'readOnly'}
      options={options}
      label={t('tex_live_version')}
      name="imageName"
    />
  )
}
