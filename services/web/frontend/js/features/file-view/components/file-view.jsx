import { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import FileViewHeader from './file-view-header'
import FileViewImage from './file-view-image'
import FileViewPdf from './file-view-pdf'
import FileViewText from './file-view-text'
import Icon from '../../../shared/components/icon'
import getMeta from '@/utils/meta'

const imageExtensions = ['png', 'jpg', 'jpeg', 'gif']

export default function FileView({ file }) {
  const [contentLoading, setContentLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const { t } = useTranslation()

  const { textExtensions, editableFilenames } = getMeta('ol-ExposedSettings')

  const extension = file.name.split('.').pop().toLowerCase()

  const isEditableTextFile =
    textExtensions.includes(extension) ||
    editableFilenames.includes(file.name.toLowerCase())

  const isImageFile = imageExtensions.includes(extension)
  const isPdfFile = extension === 'pdf'
  const isUnpreviewableFile = !isEditableTextFile && !isImageFile && !isPdfFile

  const handleLoad = useCallback(() => {
    setContentLoading(false)
  }, [])

  const handleError = useCallback(() => {
    if (!hasError) {
      setContentLoading(false)
      setHasError(true)
    }
  }, [hasError])

  const content = (
    <>
      <FileViewHeader file={file} />
      {isImageFile && (
        <FileViewImage file={file} onLoad={handleLoad} onError={handleError} />
      )}
      {isEditableTextFile && (
        <FileViewText file={file} onLoad={handleLoad} onError={handleError} />
      )}
      {isPdfFile && (
        <FileViewPdf
          fileId={file.id}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </>
  )

  return (
    <div className="file-view full-size">
      {!hasError && content}
      {!isUnpreviewableFile && contentLoading && <FileViewLoadingIndicator />}
      {(isUnpreviewableFile || hasError) && (
        <p className="no-preview">{t('no_preview_available')}</p>
      )}
    </div>
  )
}

function FileViewLoadingIndicator() {
  const { t } = useTranslation()
  return (
    <div className="loading-panel loading-panel-file-view">
      <span>
        <Icon type="refresh" spin />
        &nbsp;&nbsp;{t('loading')}…
      </span>
    </div>
  )
}

FileView.propTypes = {
  file: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    hash: PropTypes.string,
  }).isRequired,
}
