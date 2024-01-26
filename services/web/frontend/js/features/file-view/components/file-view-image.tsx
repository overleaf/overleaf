import { useProjectContext } from '../../../shared/context/project-context'

export default function FileViewImage({
  fileName,
  fileId,
  onLoad,
  onError,
}: {
  fileName: string
  fileId: string
  onLoad: () => void
  onError: () => void
}) {
  const { _id: projectId } = useProjectContext()

  return (
    <img
      src={`/project/${projectId}/file/${fileId}`}
      onLoad={onLoad}
      onError={onError}
      alt={fileName}
    />
  )
}
