import React from 'react'
import PropTypes from 'prop-types'
import { useEditorContext } from '../../../shared/context/editor-context'

export default function FileViewImage({ fileName, fileId, onLoad, onError }) {
  const { projectId } = useEditorContext({
    projectId: PropTypes.string.isRequired,
  })

  return (
    <img
      src={`/project/${projectId}/file/${fileId}`}
      onLoad={onLoad}
      onError={onError}
      onAbort={onError}
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
