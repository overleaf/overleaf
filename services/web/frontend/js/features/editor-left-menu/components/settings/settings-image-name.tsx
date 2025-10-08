import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useSetCompilationSettingWithEvent } from '../../hooks/use-set-compilation-setting'

export default function SettingsImageName() {
  const { t } = useTranslation()
  const { imageName, setImageName } = useProjectSettingsContext()
  const { write } = usePermissionsContext()
  const changeImageName = useSetCompilationSettingWithEvent(
    'image-name',
    setImageName
  )

  const allowedImageNames = useMemo(() => getMeta('ol-imageNames') || [], [])

  const options: Array<Option> = useMemo(
    () =>
      allowedImageNames
        // filter out images that aren't allowed, unless thats the current image the project is on
        .filter(image => image.allowed || image.imageName === imageName)
        .map(({ imageName, imageDesc }) => ({
          value: imageName,
          label: imageDesc,
        })),
    [allowedImageNames, imageName]
  )

  if (allowedImageNames.length === 0) {
    return null
  }

  return (
    <SettingsMenuSelect
      onChange={changeImageName}
      value={imageName}
      disabled={!write}
      options={options}
      label={t('tex_live_version')}
      name="imageName"
      translateOptions="no"
    />
  )
}
