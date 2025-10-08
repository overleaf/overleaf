import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isValidTeXFile } from '../../../../main/is-valid-tex-file'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useSetCompilationSettingWithEvent } from '../../hooks/use-set-compilation-setting'

export default function SettingsDocument() {
  const { t } = useTranslation()
  const { write } = usePermissionsContext()
  const { docs } = useFileTreeData()
  const { rootDocId, setRootDocId } = useProjectSettingsContext()
  const changeRootDoc = useSetCompilationSettingWithEvent(
    'root-doc-id',
    setRootDocId,
    { omitValueInEvent: true }
  )

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
    <SettingsMenuSelect
      onChange={changeRootDoc}
      value={rootDocId ?? ''}
      disabled={!write}
      options={validDocsOptions}
      label={t('main_document')}
      name="rootDocId"
      translateOptions="no"
    />
  )
}
