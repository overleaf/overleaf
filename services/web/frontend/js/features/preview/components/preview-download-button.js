import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import PreviewDownloadFileList from './preview-download-file-list'
import Icon from '../../../shared/components/icon'

function PreviewDownloadButton({
  isCompiling,
  outputFiles,
  pdfDownloadUrl,
  showText,
}) {
  const { t } = useTranslation()

  let textStyle = {}
  if (!showText) {
    textStyle = {
      position: 'absolute',
      right: '-100vw',
    }
  }

  const pdfDownloadDisabled = isCompiling || !pdfDownloadUrl
  const buttonElement = (
    <a
      className="btn btn-xs btn-info"
      disabled={pdfDownloadDisabled}
      download
      href={pdfDownloadUrl || '#'}
      style={{ pointerEvents: 'auto' }}
    >
      <Icon type="download" modifier="fw" />
      <span className="toolbar-text" style={textStyle}>
        {t('download_pdf')}
      </span>
    </a>
  )

  const hideTooltip = showText && pdfDownloadUrl

  return (
    <Dropdown
      id="download-dropdown"
      className="toolbar-item"
      disabled={isCompiling}
    >
      {hideTooltip ? (
        buttonElement
      ) : (
        <OverlayTrigger
          placement="bottom"
          overlay={
            <Tooltip id="tooltip-download-pdf">
              {pdfDownloadDisabled
                ? t('please_compile_pdf_before_download')
                : t('download_pdf')}
            </Tooltip>
          }
        >
          {buttonElement}
        </OverlayTrigger>
      )}
      <Dropdown.Toggle
        className="btn btn-xs btn-info dropdown-toggle"
        aria-label={t('toggle_output_files_list')}
        bsStyle="info"
      />
      <Dropdown.Menu id="download-dropdown-list">
        <PreviewDownloadFileList fileList={outputFiles} />
      </Dropdown.Menu>
    </Dropdown>
  )
}

PreviewDownloadButton.propTypes = {
  isCompiling: PropTypes.bool.isRequired,
  outputFiles: PropTypes.array,
  pdfDownloadUrl: PropTypes.string,
  showText: PropTypes.bool.isRequired,
}

export default PreviewDownloadButton
