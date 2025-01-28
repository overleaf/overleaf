import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import type { Optgroup } from './settings-menu-select'
import { useEditorContext } from '@/shared/context/editor-context'
import { supportsWebAssembly } from '@/utils/wasm'

export default function SettingsSpellCheckLanguage() {
  const { t } = useTranslation()

  const { spellCheckLanguage, setSpellCheckLanguage } =
    useProjectSettingsContext()
  const { permissionsLevel } = useEditorContext()

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
    <SettingsMenuSelect
      onChange={setSpellCheckLanguage}
      value={supportsWebAssembly() ? spellCheckLanguage : ''}
      options={[{ value: '', label: t('off') }]}
      optgroup={optgroup}
      label={t('spell_check')}
      name="spellCheckLanguage"
      disabled={permissionsLevel === 'readOnly' || !supportsWebAssembly()}
    />
  )
}
