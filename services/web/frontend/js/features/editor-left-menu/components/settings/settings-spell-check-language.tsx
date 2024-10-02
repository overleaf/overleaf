import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import type { Optgroup } from './settings-menu-select'
import { useFeatureFlag } from '@/shared/context/split-test-context'

// TODO: set to true when ready to show new languages that are only available in the client
const showClientOnlyLanguages = false

export default function SettingsSpellCheckLanguage() {
  const { t } = useTranslation()
  const languages = getMeta('ol-languages')

  const spellCheckClientEnabled = useFeatureFlag('spell-check-client')

  const { spellCheckLanguage, setSpellCheckLanguage } =
    useProjectSettingsContext()

  const optgroup: Optgroup = useMemo(() => {
    const options = (languages ?? []).filter(lang => {
      const clientOnly = lang.server === false

      if (clientOnly && !showClientOnlyLanguages) {
        return false
      }

      return spellCheckClientEnabled || !clientOnly
    })

    return {
      label: 'Language',
      options: options.map(language => ({
        value: language.code,
        label: language.name,
      })),
    }
  }, [languages, spellCheckClientEnabled])

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
