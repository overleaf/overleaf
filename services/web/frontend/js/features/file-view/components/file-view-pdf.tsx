import { FC, useCallback } from 'react'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useIdeContext } from '@/shared/context/ide-context'
import { debugConsole } from '@/utils/debugging'

const FileViewPdf: FC<{
  fileId: string
  onLoad: () => void
  onError: () => void
}> = ({ fileId, onLoad, onError }) => {
  const mountedRef = useIsMounted()

  const { fileTreeManager } = useIdeContext()
  const { previewByPath } = useFileTreePathContext()

  const handleContainer = useCallback(
    async (element: HTMLDivElement | null) => {
      if (element) {
        const { PDFJS } = await import(
          '../../pdf-preview/util/pdf-js-versions'
        ).then(m => m.default as any)

        // bail out if loading PDF.js took too long
        if (!mountedRef.current) {
          onError()
          return
        }

        const entity = fileTreeManager.findEntityById(fileId)
        const path = fileTreeManager.getEntityPath(entity)
        const preview = previewByPath(path)

        if (!preview) {
          onError()
          return
        }

        const pdf = await PDFJS.getDocument(preview.url).promise

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: 1 })

          const canvas = document.createElement('canvas')
          canvas.classList.add('pdf-page')
          canvas.width = viewport.width
          canvas.height = viewport.height
          element.append(canvas)
          page.render({
            canvasContext: canvas.getContext('2d'),
            viewport,
          })
        }

        onLoad()

        return () => {
          pdf.cleanup().catch(debugConsole.error)
          pdf.destroy()
        }
      }
    },
    [fileTreeManager, mountedRef, previewByPath, fileId, onLoad, onError]
  )

  return <div className="file-view-pdf" ref={handleContainer} />
}

export default FileViewPdf
