import { FetchError, getJSON } from '@/infrastructure/fetch-json'
import { useLocation } from '@/shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import { useProjectContext } from '@/shared/context/project-context'
import { useCallback } from 'react'
import {
  hideExportDocumentError,
  hidePreparingExportToast,
  showExportDocumentError,
  showExportDocumentSuccess,
  showPreparingExportToast,
} from '../components/toolbar/export-document-toasts'
import { RootDocInfo } from '@/shared/hooks/use-root-doc'
import { OpenDocuments } from '../editor/open-documents'

const SLOW_CONVERSION_THRESHOLD = 2000

export default function useConvertProject(
  type: 'docx' | 'markdown' | 'html',
  openDocs: OpenDocuments,
  getRootDocInfo: () => RootDocInfo
) {
  const { projectId } = useProjectContext()
  const location = useLocation()
  return useCallback(async () => {
    let handle: string | undefined
    const toastTimer = setTimeout(() => {
      handle = showPreparingExportToast()
    }, SLOW_CONVERSION_THRESHOLD)
    const hidePreparingToast = () => {
      clearTimeout(toastTimer)
      if (handle) hidePreparingExportToast(handle)
    }
    const url = new URL(window.location.origin)
    url.pathname = `/project/${projectId}/download/conversion/${type}`
    url.searchParams.set('responseFormat', 'json')
    const { rootResourcePath } = getRootDocInfo()
    url.searchParams.set('rootResourcePath', rootResourcePath)
    hideExportDocumentError()
    try {
      await openDocs.awaitBufferedOps(AbortSignal.timeout(10_000))
      const response = await getJSON(url.href)
      hidePreparingToast()
      const { downloadUrl } = response
      if (downloadUrl) {
        const url = new URL(downloadUrl, window.location.origin)
        location.assign(url.toString())
        showExportDocumentSuccess(type)
      } else {
        showExportDocumentError()
      }
    } catch (error) {
      hidePreparingToast()
      let errorMessage
      if (
        error instanceof FetchError &&
        error.response?.status === 422 &&
        error.data?.error
      ) {
        errorMessage = error.data.error
      }
      showExportDocumentError(errorMessage)
      debugConsole.error(error)
    }
  }, [projectId, type, getRootDocInfo, openDocs, location])
}
