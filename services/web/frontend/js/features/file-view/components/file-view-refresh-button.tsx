import {
  type Dispatch,
  type SetStateAction,
  type ElementType,
  useCallback,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import type { BinaryFile } from '../types/binary-file'
import { Nullable } from '../../../../../types/utils'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import OLButton from '@/shared/components/ol/ol-button'
import { sendMB } from '@/infrastructure/event-tracking'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import clientId from '@/utils/client-id'
import { useReferencesContext } from '@/features/ide-react/context/references-context'

type FileViewRefreshButtonProps = {
  setRefreshError: Dispatch<SetStateAction<Nullable<string>>>
  file: BinaryFile
}

const tprFileViewRefreshButton = importOverleafModules(
  'tprFileViewRefreshButton'
) as {
  import: { TPRFileViewRefreshButton: ElementType }
  path: string
}[]

export default function FileViewRefreshButton({
  setRefreshError,
  file,
}: FileViewRefreshButtonProps) {
  const { projectId } = useProjectContext()
  const [refreshing, setRefreshing] = useState(false)
  const isMountedRef = useIsMounted()
  const { indexAllReferences } = useReferencesContext()

  const refreshFile = useCallback(
    (isTPR: Nullable<boolean>) => {
      setRefreshing(true)
      // Replacement of the file handled by the file tree
      window.expectingLinkedFileRefreshedSocketFor = file.name
      const shouldReindexReferences = isTPR || /\.bib$/.test(file.name)
      const body = {
        shouldReindexReferences,
        clientId: clientId.get(),
      }
      postJSON(`/project/${projectId}/linked_file/${file.id}/refresh`, {
        body,
      })
        .then(() => {
          if (isMountedRef.current) {
            setRefreshing(false)
          }
          if (shouldReindexReferences) {
            indexAllReferences(false)
          }
          sendMB('refresh-linked-file', {
            provider: file.linkedFileData?.provider,
          })
        })
        .catch(err => {
          if (isMountedRef.current) {
            setRefreshing(false)
            setRefreshError(err.data?.message || err.message)
          }
        })
    },
    [file, projectId, setRefreshError, isMountedRef, indexAllReferences]
  )

  if (tprFileViewRefreshButton.length > 0) {
    return tprFileViewRefreshButton.map(
      ({ import: { TPRFileViewRefreshButton }, path }) => (
        <TPRFileViewRefreshButton
          key={path}
          file={file}
          refreshFile={refreshFile}
          refreshing={refreshing}
        />
      )
    )[0]
  } else {
    return (
      <FileViewRefreshButtonDefault
        refreshFile={refreshFile}
        refreshing={refreshing}
      />
    )
  }
}

type FileViewRefreshButtonDefaultProps = {
  refreshFile: (isTPR: Nullable<boolean>) => void
  refreshing: boolean
}

function FileViewRefreshButtonDefault({
  refreshFile,
  refreshing,
}: FileViewRefreshButtonDefaultProps) {
  const { t } = useTranslation()

  return (
    <OLButton
      variant="primary"
      onClick={() => refreshFile(null)}
      disabled={refreshing}
      isLoading={refreshing}
      loadingLabel={t('refreshing')}
    >
      {t('refresh')}
    </OLButton>
  )
}
