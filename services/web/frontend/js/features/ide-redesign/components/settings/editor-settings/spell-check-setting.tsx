import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useTranslation } from 'react-i18next'
import DropdownSetting, { Optgroup } from '../dropdown-setting'
import { useMemo } from 'react'
import getMeta from '@/utils/meta'
import { supportsWebAssembly } from '@/utils/wasm'

// TODO: Split this into separate setttings for spell check
// language and spell check on/off
export default function SpellCheckSetting() {
  const { spellCheckLanguage, setSpellCheckLanguage } =
    useProjectSettingsContext()
  const { t } = useTranslation()

  const optgroup: Optgroup = useMemo(() => {
    const options = (getMeta('ol-languages') ?? [])
      // only include spell-check languages that are available in the client
      .filter(language => language.dic !== undefined)

    return {
      label: 'Language',
      options: options.map(language => ({
        value: language.code,
        label: language.name,
      })),
    }
  }, [])

  return (
    <DropdownSetting
      id="spellCheckLanguage"
      label={t('spellcheck_language')}
      options={[{ value: '', label: t('off') }]}
      optgroups={[optgroup]}
      onChange={setSpellCheckLanguage}
      value={supportsWebAssembly() ? spellCheckLanguage : ''}
      width="wide"
    />
  )
}
