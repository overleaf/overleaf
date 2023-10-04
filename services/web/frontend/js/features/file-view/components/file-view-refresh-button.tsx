import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import Icon from '@/shared/components/icon'
import { postJSON } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import useAbortController from '@/shared/hooks/use-abort-controller'
import { useUserContext } from '@/shared/context/user-context'
import { hasProvider, type BinaryFile } from '../types/binary-file'
import { Nullable } from '../../../../../types/utils'

type FileViewRefreshButtonProps = {
  setRefreshError: Dispatch<SetStateAction<Nullable<string>>>
  file: BinaryFile
}

export default function FileViewRefreshButton({
  setRefreshError,
  file,
}: FileViewRefreshButtonProps) {
  const { signal } = useAbortController()
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)
  const { _id: projectId } = useProjectContext()
  const { id: userId } = useUserContext()

  const isMendeleyOrZotero =
    hasProvider(file, 'mendeley') || hasProvider(file, 'zotero')

  let isImporter

  if (isMendeleyOrZotero) {
    isImporter = file.linkedFileData.importer_id === userId
  }

  const buttonClickable = isMendeleyOrZotero ? isImporter : true

  const refreshFile = useCallback(() => {
    setRefreshing(true)
    // Replacement of the file handled by the file tree
    window.expectingLinkedFileRefreshedSocketFor = file.name
    const body = {
      shouldReindexReferences: isMendeleyOrZotero || /\.bib$/.test(file.name),
    }
    postJSON(`/project/${projectId}/linked_file/${file.id}/refresh`, {
      signal,
      body,
    })
      .then(() => {
        setRefreshing(false)
      })
      .catch(err => {
        setRefreshing(false)
        setRefreshError(err.data?.message || err.message)
      })
  }, [file, projectId, signal, setRefreshError, isMendeleyOrZotero])

  return (
    <button
      className={classNames('btn', {
        'btn-primary': buttonClickable,
        'btn-secondary': !buttonClickable,
      })}
      onClick={refreshFile}
      disabled={refreshing || !buttonClickable}
    >
      <Icon type="refresh" spin={refreshing} fw />
      <span>{refreshing ? `${t('refreshing')}…` : t('refresh')}</span>
    </button>
  )
}
