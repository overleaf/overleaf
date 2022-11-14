import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import SettingsMenuSelect from './settings-menu-select'
import type { Optgroup } from './settings-menu-select'

type Language = {
  name: string
  code: string
}

export default function SettingsSpellCheckLanguage() {
  const { t } = useTranslation()
  const languages = getMeta('ol-languages') as Language[] | undefined

  const optgroup: Optgroup = useMemo(
    () => ({
      label: 'Language',
      options:
        languages?.map(language => ({
          value: language.code,
          label: language.name,
        })) ?? [],
    }),
    [languages]
  )

  return (
    <SettingsMenuSelect
      options={[{ value: '', label: t('off') }]}
      optgroup={optgroup}
      label={t('spell_check')}
      name="spellCheckLanguage"
    />
  )
}
