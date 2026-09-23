import { useEffect, useState } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { debugConsole } from '@/utils/debugging'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import { BinaryFile } from '@/features/file-view/types/binary-file'

// SVGs are text documents; cap the size we are willing to render inline. An
// SVG cannot be truncated like plain text (it would no longer parse), so an
// oversized file is treated as an error rather than a partial preview.
const MAX_FILE_SIZE = 2 * 1024 * 1024

export default function FileViewSvg({
  file,
  onLoad,
  onError,
}: {
  file: BinaryFile
  onLoad: () => void
  onError: () => void
}) {
  const { projectId } = useProjectContext()

  const [objectUrl, setObjectUrl] = useState<string>()

  const fetchDataController = useAbortController()

  useEffect(() => {
    const path = `/project/${projectId}/blob/${file.hash}`
    let createdUrl: string | undefined
    const fetchDataTimeout = window.setTimeout(
      () => fetchDataController.abort(),
      60000
    )

    fetch(path, { signal: fetchDataController.signal })
      .then(response => {
        if (!response.ok) {
          throw new Error('HTTP Error Code: ' + response.status)
        }
        return response.text()
      })
      .then(svgSource => {
        // The blob endpoint serves everything as application/octet-stream, and
        // browsers refuse to sniff SVG. Re-wrap the bytes with the correct type
        // so an <img> renders them, without any backend change.
        const svgBlob = new Blob([svgSource], { type: 'image/svg+xml' })
        if (svgBlob.size > MAX_FILE_SIZE) {
          throw new Error('SVG file is too large to preview')
        }
        createdUrl = URL.createObjectURL(svgBlob)
        setObjectUrl(createdUrl)
      })
      .catch(err => {
        debugConsole.error('Error fetching SVG file contents', err)
        onError()
      })
      .finally(() => {
        clearTimeout(fetchDataTimeout)
      })

    return () => {
      clearTimeout(fetchDataTimeout)
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [projectId, file.hash, fetchDataController, onError])

  if (!objectUrl) {
    return null
  }

  return (
    <img src={objectUrl} onLoad={onLoad} onError={onError} alt={file.name} />
  )
}
