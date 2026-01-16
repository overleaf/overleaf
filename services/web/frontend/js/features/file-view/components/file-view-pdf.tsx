import { FC, useCallback } from 'react'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'

const FileViewPdf: FC<{
  fileId: string
  onLoad: () => void
  onError: () => void
}> = ({ fileId, onLoad, onError }) => {
  const mountedRef = useIsMounted()

  const { previewByPath, pathInFolder } = useFileTreePathContext()

  const handleContainer = useCallback(
    async (element: HTMLDivElement | null) => {
      if (element) {
        const { loadPdfDocumentFromUrl } =
          await import('@/features/pdf-preview/util/pdf-js')

        // bail out if loading PDF.js took too long
        if (!mountedRef.current) {
          return
        }

        const path = pathInFolder(fileId)
        const preview = path ? previewByPath(path) : null

        if (!preview) {
          onError()
          return
        }

        const pdf = await loadPdfDocumentFromUrl(preview.url).promise

        // bail out if loading the PDF took too long
        if (!mountedRef.current) {
          return
        }

        element.textContent = '' // ensure the element is empty

        const scale = window.devicePixelRatio || 1

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)

          // bail out if the component has been unmounted
          if (!mountedRef.current) {
            return
          }

          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.classList.add('pdf-page')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${viewport.width / scale}px`
          canvas.style.height = `${viewport.height / scale}px`

          element.append(canvas)
          page.render({
            canvasContext: canvas.getContext('2d')!,
            viewport,
          })
        }

        onLoad()
      }
    },
    [mountedRef, pathInFolder, fileId, previewByPath, onLoad, onError]
  )

  return <div className="file-view-pdf" ref={handleContainer} />
}

export default FileViewPdf
