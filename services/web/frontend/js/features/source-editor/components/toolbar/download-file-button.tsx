import OLButton from '@/shared/components/ol/ol-button'
import { useCodeMirrorViewContext } from '../codemirror-context'
import { useCallback } from 'react'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useTranslation } from 'react-i18next'

const DownloadFileButton = () => {
  const view = useCodeMirrorViewContext()
  const { openDocName } = useEditorOpenDocContext()
  const { t } = useTranslation()

  const downloadFile = useCallback(() => {
    const doc = view.state.doc.toString()
    const blob = new Blob([doc], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = openDocName ?? 'document.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [view, openDocName])

  return (
    <OLButton variant="secondary" size="sm" onClick={downloadFile}>
      {t('download_file')}
    </OLButton>
  )
}

export default DownloadFileButton
