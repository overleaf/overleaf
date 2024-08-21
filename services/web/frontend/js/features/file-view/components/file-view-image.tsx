import { useProjectContext } from '../../../shared/context/project-context'
import { useSnapshotContext } from '@/features/ide-react/context/snapshot-context'
import { BinaryFile } from '@/features/file-view/types/binary-file'

export default function FileViewImage({
  file,
  onLoad,
  onError,
}: {
  file: BinaryFile
  onLoad: () => void
  onError: () => void
}) {
  const { _id: projectId } = useProjectContext()
  const { fileTreeFromHistory } = useSnapshotContext()

  return (
    <img
      src={
        fileTreeFromHistory
          ? `/project/${projectId}/blob/${file.hash}`
          : `/project/${projectId}/file/${file.id}`
      }
      onLoad={onLoad}
      onError={onError}
      alt={file.name}
    />
  )
}
