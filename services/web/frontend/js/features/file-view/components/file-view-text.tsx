import { useState, useEffect } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { debugConsole } from '@/utils/debugging'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import { BinaryFile } from '@/features/file-view/types/binary-file'

const MAX_FILE_SIZE = 2 * 1024 * 1024

export default function FileViewText({
  file,
  onLoad,
  onError,
}: {
  file: BinaryFile
  onLoad: () => void
  onError: () => void
}) {
  const { projectId } = useProjectContext()

  const [textPreview, setTextPreview] = useState('')
  const [shouldShowDots, setShouldShowDots] = useState(false)
  const [inFlight, setInFlight] = useState(false)

  const fetchContentLengthController = useAbortController()
  const fetchDataController = useAbortController()

  useEffect(() => {
    if (inFlight) {
      return
    }
    const path = `/project/${projectId}/blob/${file.hash}`
    const fetchContentLengthTimeout = setTimeout(
      () => fetchContentLengthController.abort(),
      10000
    )
    let fetchDataTimeout: number | undefined
    fetch(path, { method: 'HEAD', signal: fetchContentLengthController.signal })
      .then(response => {
        if (!response.ok) throw new Error('HTTP Error Code: ' + response.status)
        return response.headers.get('Content-Length')
      })
      .then(fileSize => {
        let truncated = false
        const headers = new Headers()
        if (fileSize && Number(fileSize) > MAX_FILE_SIZE) {
          truncated = true
          headers.set('Range', `bytes=0-${MAX_FILE_SIZE}`)
        }
        fetchDataTimeout = window.setTimeout(
          () => fetchDataController.abort(),
          60000
        )
        const signal = fetchDataController.signal
        return fetch(path, { signal, headers }).then(response => {
          return response.text().then(text => {
            if (truncated) {
              text = text.replace(/\n.*$/, '')
            }

            setTextPreview(text)
            onLoad()
            setShouldShowDots(truncated)
          })
        })
      })
      .catch(err => {
        debugConsole.error('Error fetching file contents', err)
        onError()
      })
      .finally(() => {
        setInFlight(false)
        clearTimeout(fetchContentLengthTimeout)
        clearTimeout(fetchDataTimeout)
      })
  }, [
    projectId,
    file.id,
    file.hash,
    onError,
    onLoad,
    inFlight,
    fetchContentLengthController,
    fetchDataController,
  ])
  return (
    Boolean(textPreview) && (
      <div className="text-preview">
        <div className="scroll-container">
          <p>{textPreview}</p>
          {shouldShowDots && <p>...</p>}
        </div>
      </div>
    )
  )
}
