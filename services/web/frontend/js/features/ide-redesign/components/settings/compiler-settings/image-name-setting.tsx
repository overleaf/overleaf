import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import type { Option } from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useMemo } from 'react'
import getMeta from '@/utils/meta'

export default function ImageNameSetting() {
  const { imageName, setImageName } = useProjectSettingsContext()
  const { t } = useTranslation()
  const { write } = usePermissionsContext()

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
    <DropdownSetting
      id="imageName"
      label={t('tex_live_version')}
      description={t('the_version_of_tex_live_used_for_compiling')}
      disabled={!write}
      options={options}
      onChange={setImageName}
      value={imageName}
    />
  )
}
