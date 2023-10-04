import { useTranslation } from 'react-i18next'
import { capitalize } from 'lodash'
import { useUserContext } from '@/shared/context/user-context'
import { BinaryFile, hasProvider } from '../types/binary-file'

type FileViewNotOriginalImporterProps = {
  file: BinaryFile
}

export default function FileViewNotOriginalImporter({
  file,
}: FileViewNotOriginalImporterProps) {
  const { t } = useTranslation()
  const { id: userId } = useUserContext()

  const isMendeleyOrZotero =
    hasProvider(file, 'mendeley') || hasProvider(file, 'zotero')

  if (!isMendeleyOrZotero) {
    return null
  }

  const isImporter = file.linkedFileData.importer_id === userId

  if (isImporter) {
    return null
  }

  return (
    <div className="row">
      <div className="alert">
        {t('only_importer_can_refresh', {
          provider: capitalize(file.linkedFileData.provider),
        })}
      </div>
    </div>
  )
}
