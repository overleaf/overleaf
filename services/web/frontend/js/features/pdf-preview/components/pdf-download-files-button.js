import { Dropdown } from 'react-bootstrap'
import PdfFileList from './pdf-file-list'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import { memo } from 'react'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import { useTranslation } from 'react-i18next'

function PdfDownloadFilesButton() {
  const { compiling, fileList } = usePdfPreviewContext()

  const { t } = useTranslation()

  return (
    <ControlledDropdown
      id="dropdown-files-logs-pane"
      dropup
      pullRight
      disabled={compiling || !fileList}
    >
      <Dropdown.Toggle
        className="dropdown-toggle"
        title={t('other_logs_and_files')}
        bsSize="small"
        bsStyle="info"
      />
      <Dropdown.Menu id="dropdown-files-logs-pane-list">
        <PdfFileList fileList={fileList} />
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}

export default memo(PdfDownloadFilesButton)
