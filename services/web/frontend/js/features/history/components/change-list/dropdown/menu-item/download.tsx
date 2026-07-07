import { useTranslation } from 'react-i18next'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import MaterialIcon from '@/shared/components/material-icon'

type DownloadProps = {
  projectId: string
  version: number
  closeDropdown: () => void
}

function Download({
  version,
  projectId,
  closeDropdown,
  ...props
}: DownloadProps) {
  const { t } = useTranslation()

  return (
    <DropdownMenuItem
      href={`/project/${projectId}/version/${version}/zip`}
      download={`${projectId}_v${version}.zip`}
      rel="noreferrer"
      onClick={closeDropdown}
      leadingIcon={<MaterialIcon type="download" />}
      {...props}
    >
      {t('history_download_this_version')}
    </DropdownMenuItem>
  )
}

export default Download
