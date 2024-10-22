import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import type { Optgroup } from './settings-menu-select'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export default function SettingsSpellCheckLanguage() {
  const { t } = useTranslation()
  const languages = getMeta('ol-languages')

  const spellCheckClientEnabled = useFeatureFlag('spell-check-client')
  const spellCheckNoServer = useFeatureFlag('spell-check-no-server')

  const { spellCheckLanguage, setSpellCheckLanguage } =
    useProjectSettingsContext()

  const optgroup: Optgroup = useMemo(() => {
    const options = (languages ?? []).filter(language => {
      if (!spellCheckClientEnabled) {
        // only include spell-check languages that are available on the server
        return language.server !== false
      }

      if (spellCheckNoServer) {
        // only include spell-check languages that are available in the client
        return language.dic !== undefined
      }

      return true
    })

    return {
      label: 'Language',
      options: options.map(language => ({
        value: language.code,
        label: language.name,
      })),
    }
  }, [languages, spellCheckClientEnabled, spellCheckNoServer])

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
