import { useTranslation } from 'react-i18next'
import RailPanelHeader from '../rail-panel-header'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import PdfFileList from '@/features/pdf-preview/components/pdf-file-list'
import { forwardRef } from 'react'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

export default function ErrorLogsHeader() {
  const { t } = useTranslation()

  return (
    <RailPanelHeader
      title={t('logs')}
      actions={[
        <DownloadFileDropdown key="download-files" />,
        <ClearCacheButton key="clear-cache" />,
      ]}
    />
  )
}

const ClearCacheButton = () => {
  const { compiling, clearCache, clearingCache } = useCompileContext()
  const { t } = useTranslation()

  return (
    <OLTooltip
      id="clear-cache"
      description={t('clear_cached_files')}
      overlayProps={{ placement: 'bottom' }}
    >
      <OLIconButton
        unfilled
        onClick={() => clearCache()}
        className="rail-panel-header-button-subdued"
        icon="auto_delete"
        isLoading={clearingCache}
        disabled={clearingCache || compiling}
        accessibilityLabel={t('clear_cached_files')}
        size="sm"
      />
    </OLTooltip>
  )
}

const DownloadFileDropdown = () => {
  const { fileList } = useCompileContext()

  const { t } = useTranslation()

  return (
    <Dropdown align="end">
      <DropdownToggle
        as={DownloadFileDropdownToggleButton}
        id="dropdown-files-dropdown-toggle"
      >
        {t('other_logs_and_files')}
      </DropdownToggle>
      {fileList && (
        <DropdownMenu id="dropdown-files-logs-pane-list">
          <PdfFileList fileList={fileList} />
        </DropdownMenu>
      )}
    </Dropdown>
  )
}

const DownloadFileDropdownToggleButton = forwardRef<
  HTMLButtonElement,
  { onClick: React.MouseEventHandler }
>(function DownloadFileDropdownToggleButton({ onClick }, ref) {
  const { compiling, fileList } = useCompileContext()
  const { t } = useTranslation()

  return (
    <OLTooltip
      id="more-logs-and-files"
      description={t('more_logs_and_files')}
      overlayProps={{ placement: 'bottom' }}
    >
      <OLIconButton
        ref={ref}
        onClick={onClick}
        className="rail-panel-header-button-subdued"
        icon="download"
        disabled={compiling || !fileList}
        accessibilityLabel={t('other_logs_and_files')}
        size="sm"
      />
    </OLTooltip>
  )
})
