import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'

/* eslint-disable react/no-unused-prop-types */
type AllowedImageName = {
  imageDesc: string
  imageName: string
}
/* eslint-enable */

export default function SettingsImageName() {
  const { t } = useTranslation()
  const allowedImageNames = getMeta('ol-allowedImageNames') as
    | AllowedImageName[]
    | undefined

  const options: Array<Option> = useMemo(
    () =>
      allowedImageNames?.map(({ imageName, imageDesc }) => ({
        value: imageName,
        label: imageDesc,
      })) ?? [],
    [allowedImageNames]
  )

  if ((allowedImageNames?.length ?? 0) === 0) {
    return null
  }

  return (
    <SettingsMenuSelect
      options={options}
      label={t('tex_live_version')}
      name="imageName"
    />
  )
}
