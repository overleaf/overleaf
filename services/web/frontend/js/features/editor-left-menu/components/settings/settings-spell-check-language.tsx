import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import type { Optgroup } from './settings-menu-select'

export default function SettingsSpellCheckLanguage() {
  const { t } = useTranslation()
  const languages = getMeta('ol-languages')

  const { spellCheckLanguage, setSpellCheckLanguage } =
    useProjectSettingsContext()

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
      onChange={setSpellCheckLanguage}
      value={spellCheckLanguage}
      options={[{ value: '', label: t('off') }]}
      optgroup={optgroup}
      label={t('spell_check')}
      name="spellCheckLanguage"
    />
  )
}
