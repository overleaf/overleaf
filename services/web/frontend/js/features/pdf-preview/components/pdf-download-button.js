import { useTranslation } from 'react-i18next'
import { Button, Dropdown } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import PdfFileList from './pdf-file-list'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import { memo } from 'react'

function PdfDownloadButton() {
  const { compiling, pdfDownloadUrl, fileList } = usePdfPreviewContext()

  const { t } = useTranslation()

  const disabled = compiling || !pdfDownloadUrl

  return (
    <ControlledDropdown
      id="pdf-download-dropdown"
      className="toolbar-item"
      disabled={disabled}
    >
      <Button
        bsSize="xsmall"
        bsStyle="info"
        disabled={compiling || !pdfDownloadUrl}
        download
        href={pdfDownloadUrl || '#'}
      >
        <Icon type="download" modifier="fw" />
        <span className="toolbar-text toolbar-hide-medium toolbar-hide-small">
          {t('download_pdf')}
        </span>
      </Button>

      <Dropdown.Toggle
        bsSize="xsmall"
        bsStyle="info"
        className="dropdown-toggle"
        aria-label={t('toggle_output_files_list')}
        disabled={!fileList}
      />

      <Dropdown.Menu id="download-dropdown-list">
        <PdfFileList fileList={fileList} />
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}

export default memo(PdfDownloadButton)
