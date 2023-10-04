import type { ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { BinaryFile, hasProvider } from '../types/binary-file'

const tprLinkedFileRefreshError = importOverleafModules(
  'tprLinkedFileRefreshError'
) as {
  import: { LinkedFileRefreshError: ElementType }
  path: string
}[]

type FileViewRefreshErrorProps = {
  file: BinaryFile
  refreshError: string
}

export default function FileViewRefreshError({
  file,
  refreshError,
}: FileViewRefreshErrorProps) {
  const isMendeleyOrZotero =
    hasProvider(file, 'mendeley') || hasProvider(file, 'zotero')

  return (
    <div className="row">
      <br />

      {isMendeleyOrZotero ? (
        <FileViewMendeleyOrZoteroRefreshError file={file} />
      ) : (
        <FileViewDefaultRefreshError refreshError={refreshError} />
      )}
    </div>
  )
}

type FileViewMendeleyOrZoteroRefreshErrorProps = {
  file: BinaryFile
}

function FileViewMendeleyOrZoteroRefreshError({
  file,
}: FileViewMendeleyOrZoteroRefreshErrorProps) {
  const { t } = useTranslation()
  return (
    <div
      className="alert alert-danger col-md-10 col-md-offset-1"
      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
    >
      <div>
        {t('something_not_right')}!&nbsp;
        {tprLinkedFileRefreshError.map(
          ({ import: { LinkedFileRefreshError }, path }) => (
            <LinkedFileRefreshError key={path} file={file} />
          )
        )}
      </div>
      <div className="text-center">
        <button className="btn btn-danger">
          <a
            href="/user/settings"
            target="_blank"
            style={{ fontWeight: 'bold', textDecoration: 'none' }}
          >
            {t('go_to_settings')}
          </a>
        </button>
      </div>
    </div>
  )
}

type FileViewDefaultRefreshErrorProps = {
  refreshError: string
}

function FileViewDefaultRefreshError({
  refreshError,
}: FileViewDefaultRefreshErrorProps) {
  const { t } = useTranslation()
  return (
    <div className="alert alert-danger col-md-6 col-md-offset-3">
      {t('access_denied')}: {refreshError}
    </div>
  )
}
