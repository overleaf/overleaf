import React from 'react'
import PropTypes from 'prop-types'

export default function BinaryFileImage({ fileName, fileId, onLoad, onError }) {
  return (
    <img
      src={`/project/${window.project_id}/file/${fileId}`}
      onLoad={onLoad}
      onError={onError}
      onAbort={onError}
      alt={fileName}
    />
  )
}

BinaryFileImage.propTypes = {
  fileName: PropTypes.string.isRequired,
  fileId: PropTypes.string.isRequired,
  onLoad: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
}
