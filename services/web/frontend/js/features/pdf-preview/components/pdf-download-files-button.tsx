import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
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
    <OLDropdown drop="up">
      <OLDropdownToggle
        id="dropdown-files-logs-pane"
        variant="secondary"
        size="sm"
        disabled={compiling || !fileList}
      >
        {t('other_logs_and_files')}
      </OLDropdownToggle>
      <OLDropdownMenu id="dropdown-files-logs-pane-list">
        <PdfFileList fileList={fileList} />
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default memo(PdfDownloadFilesButton)
