import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import PdfFileList from './pdf-file-list'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfDownloadFilesButton() {
  const { compiling, fileList } = useCompileContext()

  const { t } = useTranslation()

  if (!fileList) {
    return null
  }

  return (
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
  )
}

export default memo(PdfDownloadFilesButton)
