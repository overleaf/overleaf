import { Dropdown as BS3Dropdown } from 'react-bootstrap'

import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import PdfFileList from './pdf-file-list'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function PdfDownloadFilesButton() {
  const { compiling, fileList } = useCompileContext()

  const { t } = useTranslation()

  if (!fileList) {
    return null
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <ControlledDropdown
          id="dropdown-files-logs-pane"
          dropup
          pullRight
          disabled={compiling || !fileList}
        >
          <BS3Dropdown.Toggle
            className="dropdown-toggle btn-secondary-info btn-secondary"
            title={t('other_logs_and_files')}
            bsSize="small"
            bsStyle={null}
          />
          <BS3Dropdown.Menu id="dropdown-files-logs-pane-list">
            <PdfFileList fileList={fileList} />
          </BS3Dropdown.Menu>
        </ControlledDropdown>
      }
      bs5={
        <Dropdown drop="up">
          <DropdownToggle
            id="dropdown-files-logs-pane"
            variant="secondary"
            size="sm"
            disabled={compiling || !fileList}
          >
            {t('other_logs_and_files')}
          </DropdownToggle>
          <DropdownMenu id="dropdown-files-logs-pane-list">
            <PdfFileList fileList={fileList} />
          </DropdownMenu>
        </Dropdown>
      }
    />
  )
}

export default memo(PdfDownloadFilesButton)
