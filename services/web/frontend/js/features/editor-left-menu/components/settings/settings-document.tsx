import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import isValidTeXFile from '../../../../main/is-valid-tex-file'
import { useEditorContext } from '../../../../shared/context/editor-context'
import { useProjectContext } from '../../../../shared/context/project-context'
import useScopeValue from '../../../../shared/hooks/use-scope-value'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'

type Doc = {
  doc: {
    name: string
    id: string
    type: string
    selected: boolean
  }
  path: string
}

export default function SettingsDocument() {
  const { t } = useTranslation()

  const { permissionsLevel } = useEditorContext()

  const { rootDocId } = useProjectContext()
  const [docs] = useScopeValue<Doc[] | undefined>('docs')

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
      options={validDocsOptions}
      label={t('main_document')}
      name="rootDoc_id"
    />
  )
}
