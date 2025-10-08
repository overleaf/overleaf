import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import type { Option } from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useMemo } from 'react'
import getMeta from '@/utils/meta'
import { useSetCompilationSettingWithEvent } from '@/features/editor-left-menu/hooks/use-set-compilation-setting'

export default function ImageNameSetting() {
  const { imageName, setImageName } = useProjectSettingsContext()
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const changeImageName = useSetCompilationSettingWithEvent(
    'image-name',
    setImageName
  )

  const imageNames = useMemo(() => getMeta('ol-imageNames') || [], [])

  const options: Array<Option> = useMemo(
    () =>
      imageNames
        // filter out images that aren't allowed, unless thats the current image the project is on
        .filter(image => image.allowed || image.imageName === imageName)
        .map(({ imageName, imageDesc }) => ({
          value: imageName,
          label: imageDesc,
        })),
    [imageNames, imageName]
  )

  if (imageNames.length === 0) {
    return null
  }

  return (
    <DropdownSetting
      id="imageName"
      label={t('tex_live_version')}
      description={t('the_version_of_tex_live_used_for_compiling')}
      disabled={!write}
      options={options}
      onChange={changeImageName}
      value={imageName}
      translateOptions="no"
    />
  )
}
