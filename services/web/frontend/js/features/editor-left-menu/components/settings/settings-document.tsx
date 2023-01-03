import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import isValidTeXFile from '../../../../main/is-valid-tex-file'
import { useEditorContext } from '../../../../shared/context/editor-context'
import useScopeValue from '../../../../shared/hooks/use-scope-value'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'
import type { MainDocument } from '../../../../../../types/project-settings'

export default function SettingsDocument() {
  const { t } = useTranslation()
  const { permissionsLevel } = useEditorContext()
  const [docs] = useScopeValue<MainDocument[] | undefined>('docs')
  const { rootDocId, setRootDocId } = useProjectSettingsContext()

  const validDocsOptions = useMemo(() => {
    const filteredDocs =
      docs?.filter(
        doc => isValidTeXFile(doc.doc.name) || rootDocId === doc.doc.id
      ) ?? []

    const mappedDocs: Array<Option> = filteredDocs.map(doc => ({
      value: doc.doc.id,
      label: doc.doc.name,
    }))

    return mappedDocs
  }, [docs, rootDocId])

  if (permissionsLevel === 'readOnly') {
    return null
  }

  return (
    <SettingsMenuSelect
      onChange={setRootDocId}
      value={rootDocId}
      options={validDocsOptions}
      label={t('main_document')}
      name="rootDocId"
    />
  )
}
