import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import { useMemo } from 'react'
import type { Option } from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { isValidTeXFile } from '@/main/is-valid-tex-file'

export default function RootDocumentSetting() {
  const { rootDocId, setRootDocId } = useProjectSettingsContext()
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const { docs } = useFileTreeData()

  const validDocsOptions = useMemo(() => {
    const filteredDocs =
      docs?.filter(
        doc => isValidTeXFile(doc.doc.name) || rootDocId === doc.doc.id
      ) ?? []

    const mappedDocs: Array<Option> = filteredDocs.map(doc => ({
      value: doc.doc.id,
      label: doc.path,
    }))

    if (!rootDocId) {
      mappedDocs.unshift({
        value: '',
        label: 'None',
        disabled: true,
      })
    }

    return mappedDocs
  }, [docs, rootDocId])

  return (
    <DropdownSetting
      id="rootDocId"
      label={t('main_document')}
      description={t('the_primary_file_for_compiling_your_project')}
      disabled={!write}
      options={validDocsOptions}
      onChange={setRootDocId}
      value={rootDocId}
    />
  )
}
