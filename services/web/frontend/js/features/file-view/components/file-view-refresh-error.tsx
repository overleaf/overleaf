import type { ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { BinaryFile } from '../types/binary-file'
import OLNotification from '@/features/ui/components/ol/ol-notification'

type FileViewRefreshErrorProps = {
  file: BinaryFile
  refreshError: string
}

const tprFileViewRefreshError = importOverleafModules(
  'tprFileViewRefreshError'
) as {
  import: { TPRFileViewRefreshError: ElementType }
  path: string
}[]

export default function FileViewRefreshError({
  file,
  refreshError,
}: FileViewRefreshErrorProps) {
  const { t } = useTranslation()

  if (tprFileViewRefreshError.length > 0) {
    return tprFileViewRefreshError.map(
      ({ import: { TPRFileViewRefreshError }, path }) => (
        <TPRFileViewRefreshError
          key={path}
          file={file}
          refreshError={refreshError}
        />
      )
    )[0]
  } else {
    return (
      <div className="file-view-error">
        <OLNotification
          type="error"
          content={
            <span>
              {t('access_denied')}: {refreshError}
            </span>
          }
        />
      </div>
    )
  }
}
