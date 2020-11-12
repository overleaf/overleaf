import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown, MenuItem, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import Icon from '../../../shared/components/icon'

export const topFileTypes = ['bbl', 'gls', 'ind']

function PreviewDownloadButton({
  isCompiling,
  outputFiles,
  pdfDownloadUrl,
  showText
}) {
  let topFiles = []
  let otherFiles = []
  const { t } = useTranslation()

  if (outputFiles) {
    topFiles = outputFiles.filter(file => {
      if (topFileTypes.includes(file.type)) {
        return file
      }
    })

    otherFiles = outputFiles.filter(file => {
      if (!topFileTypes.includes(file.type)) {
        if (file.type === 'pdf' && file.main === true) return
        return file
      }
    })
  }

  let textStyle = {}
  if (!showText) {
    textStyle = {
      position: 'absolute',
      right: '-100vw'
    }
  }

  const buttonElement = (
    <a
      className="btn btn-xs btn-info"
      disabled={isCompiling || !pdfDownloadUrl}
      download
      href={pdfDownloadUrl || '#'}
    >
      <Icon type="download" modifier="fw" />
      <span className="toolbar-text" style={textStyle}>
        {t('download_pdf')}
      </span>
    </a>
  )

  return (
    <Dropdown
      id="download-dropdown"
      className="toolbar-item"
      disabled={isCompiling}
    >
      {showText ? (
        buttonElement
      ) : (
        <OverlayTrigger
          placement="bottom"
          overlay={
            <Tooltip id="tooltip-download-pdf">{t('download_pdf')}</Tooltip>
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
        <FileList list={topFiles} listType="main" />
        {otherFiles.length > 0 && topFiles.length > 0 ? (
          <>
            <MenuItem divider />
            <MenuItem header>{t('other_output_files')}</MenuItem>
          </>
        ) : (
          <></>
        )}
        {otherFiles.length > 0 ? (
          <>
            <FileList list={otherFiles} listType="other" />
          </>
        ) : (
          <></>
        )}
      </Dropdown.Menu>
    </Dropdown>
  )
}

function FileList({ listType, list }) {
  return list.map((file, index) => {
    return (
      <MenuItem download href={file.url} key={`${listType}-${index}`}>
        <Trans
          i18nKey="download_file"
          components={[<strong />]}
          values={{ type: file.fileName }}
        />
      </MenuItem>
    )
  })
}

PreviewDownloadButton.propTypes = {
  isCompiling: PropTypes.bool.isRequired,
  outputFiles: PropTypes.array,
  pdfDownloadUrl: PropTypes.string,
  showText: PropTypes.bool.isRequired
}

FileList.propTypes = {
  list: PropTypes.array.isRequired,
  listType: PropTypes.string.isRequired
}

export default PreviewDownloadButton
