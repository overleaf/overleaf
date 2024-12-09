import { useProjectContext } from '../../../shared/context/project-context'
import { BinaryFile } from '@/features/file-view/types/binary-file'
import { fileUrl } from '../../utils/fileUrl'

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
  return (
    <img
      src={fileUrl(projectId, file.id, file.hash)}
      onLoad={onLoad}
      onError={onError}
      alt={file.name}
    />
  )
}
