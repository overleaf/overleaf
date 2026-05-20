import { useState, useEffect } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { debugConsole } from '@/utils/debugging'
import { BinaryFile } from '@/features/file-view/types/binary-file'
import useAbortController from '@/shared/hooks/use-abort-controller'

export default function FileViewImage({
  file,
  onLoad,
  onError,
}: {
  file: BinaryFile
  onLoad: () => void
  onError: () => void
}) {
  const { projectId } = useProjectContext()

  const urlPath = `/project/${projectId}/blob/${file.hash}`
  const extension = file.name.split('.')?.pop()?.toLowerCase()

  if (extension === 'svg') {
    return (
      <SVGRenderer
        url={urlPath}
        onLoad={onLoad}
        onError={onError}
        alt={file.name}
      />
    )
  } else {
    return (
      <img src={urlPath} onLoad={onLoad} onError={onError} alt={file.name} />
    )
  }
}

type SVGRendererProps = {
  url: string
  alt: string
  onLoad: () => void
  onError: () => void
}

function SVGRenderer({ url, alt, onLoad, onError }: SVGRendererProps) {
  const { signal } = useAbortController()
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    let blobUrl: string | null = null
    setObjectUrl(null)
    fetch(url, { signal })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Error fetching SVG: ${res.statusText}`)
        }
        return res.arrayBuffer()
      })
      .then(buffer => {
        const blob = new Blob([buffer], { type: 'image/svg+xml' })
        blobUrl = URL.createObjectURL(blob)
        setObjectUrl(blobUrl)
      })
      .catch(err => {
        if (signal.aborted) return
        debugConsole.error('Unable to render SVG', err)
        onError()
      })

    return () => {
      if (blobUrl) {
        // URL.createObjectURL() allocates memory that is not garbage-collected automatically,
        // we're explicitly releasing it on effect cleanup.
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [url, onError, signal])

  if (!objectUrl) {
    return null
  }

  return <img src={objectUrl} onLoad={onLoad} onError={onError} alt={alt} />
}
