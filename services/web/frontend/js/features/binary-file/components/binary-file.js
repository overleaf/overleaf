import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import BinaryFileHeader from './binary-file-header'
import BinaryFileImage from './binary-file-image'
import BinaryFileText from './binary-file-text'
import Icon from '../../../shared/components/icon'

const imageExtensions = ['png', 'jpg', 'jpeg', 'gif']

const textExtensions = window.ExposedSettings.textExtensions

export default function BinaryFile({ file, storeReferencesKeys }) {
  const [contentLoading, setContentLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const { t } = useTranslation()

  const extension = file.name.split('.').pop().toLowerCase()
  const isUnpreviewableFile =
    !imageExtensions.includes(extension) && !textExtensions.includes(extension)

  function handleLoading() {
    if (contentLoading) {
      setContentLoading(false)
    }
  }

  function handleError() {
    if (!hasError) {
      setContentLoading(false)
      setHasError(true)
    }
  }

  const content = (
    <>
      <BinaryFileHeader file={file} storeReferencesKeys={storeReferencesKeys} />
      {imageExtensions.includes(extension) && (
        <BinaryFileImage
          fileName={file.name}
          fileId={file.id}
          onLoad={handleLoading}
          onError={handleError}
        />
      )}
      {textExtensions.includes(extension) && (
        <BinaryFileText
          file={file}
          onLoad={handleLoading}
          onError={handleError}
        />
      )}
    </>
  )

  return (
    <div className="binary-file full-size">
      {!hasError && content}
      {!isUnpreviewableFile && contentLoading && <BinaryFileLoadingIndicator />}
      {(isUnpreviewableFile || hasError) && (
        <p className="no-preview">{t('no_preview_available')}</p>
      )}
    </div>
  )
}

function BinaryFileLoadingIndicator() {
  const { t } = useTranslation()
  return (
    <div className="loading-panel loading-panel-binary-files">
      <span>
        <Icon type="refresh" modifier="spin" />
        &nbsp;&nbsp;{t('loading')}…
      </span>
    </div>
  )
}

BinaryFile.propTypes = {
  file: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  storeReferencesKeys: PropTypes.func.isRequired,
}
