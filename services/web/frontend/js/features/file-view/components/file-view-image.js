import PropTypes from 'prop-types'
import { useProjectContext } from '../../../shared/context/project-context'

export default function FileViewImage({ fileName, fileId, onLoad, onError }) {
  const { _id: projectId } = useProjectContext({
    _id: PropTypes.string.isRequired,
  })

  return (
    <img
      src={`/project/${projectId}/file/${fileId}`}
      onLoad={onLoad}
      onError={onError}
      alt={fileName}
    />
  )
}

FileViewImage.propTypes = {
  fileName: PropTypes.string.isRequired,
  fileId: PropTypes.string.isRequired,
  onLoad: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
}
