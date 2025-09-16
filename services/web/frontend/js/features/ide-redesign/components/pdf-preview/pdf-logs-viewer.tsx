import classnames from 'classnames'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import ErrorLogs from '../error-logs/error-logs'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'

export default function PdfLogsViewer() {
  const { showLogs } = useCompileContext()
  const { loadingError } = usePdfPreviewContext()

  return (
    <div
      className={classnames('new-logs-pane', {
        hidden: !showLogs && !loadingError,
      })}
    >
      <ErrorLogs includeActionButtons />
    </div>
  )
}
