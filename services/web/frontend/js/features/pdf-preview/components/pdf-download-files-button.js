import { Dropdown } from 'react-bootstrap'
import PdfFileList from './pdf-file-list'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfDownloadFilesButton() {
  const { compiling, fileList } = useCompileContext()

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
