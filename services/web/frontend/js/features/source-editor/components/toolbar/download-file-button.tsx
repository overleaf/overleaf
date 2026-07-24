import OLButton from '@/shared/components/ol/ol-button'
import { useCodeMirrorViewContext } from '../codemirror-context'
import { useCallback } from 'react'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useTranslation } from 'react-i18next'
import { downloadFileContent } from '@/utils/download-file'

const DownloadFileButton = () => {
  const view = useCodeMirrorViewContext()
  const { openDocName } = useEditorOpenDocContext()
  const { t } = useTranslation()

  const downloadFile = useCallback(() => {
    const doc = view.state.doc.toString()
    downloadFileContent(doc, openDocName ?? 'document.txt')
  }, [view, openDocName])

  return (
    <OLButton variant="secondary" size="sm" onClick={downloadFile}>
      {t('download_file')}
    </OLButton>
  )
}

export default DownloadFileButton
