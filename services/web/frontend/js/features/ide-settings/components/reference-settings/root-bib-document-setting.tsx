import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useMemo } from 'react'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import DropdownSetting from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { useBibliographyDocId } from '../../hooks/use-bibliography-doc-id'

export default function RootBibDocumentSetting() {
  const { docs } = useFileTreeData()
  const { write } = usePermissionsContext()
  const { t } = useTranslation()
  const { setMainBibliographyDocId, mainBibliographyDocId } =
    useBibliographyDocId()

  const validDocsOptions = useMemo(() => {
    return docs
      ?.filter(doc => doc.doc.name.toLowerCase().endsWith('.bib'))
      .map(doc => ({ value: doc.doc.id, label: doc.path }))
  }, [docs])

  return (
    <DropdownSetting
      id="mainBibliographyDocId"
      label={t('main_bibliography_file_for_this_project')}
      description={`${t(
        'this_is_the_file_that_references_pulled_from_your_reference_manager_will_be_added_to'
      )}`}
      disabled={!write || !validDocsOptions?.length}
      options={validDocsOptions ?? []}
      onChange={setMainBibliographyDocId}
      value={mainBibliographyDocId ?? ''}
      translateOptions="no"
    />
  )
}
