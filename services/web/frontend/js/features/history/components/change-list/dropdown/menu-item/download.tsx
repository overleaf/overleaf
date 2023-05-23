import { useTranslation } from 'react-i18next'
import { MenuItem } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'

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
    <MenuItem
      href={`/project/${projectId}/version/${version}/zip`}
      download={`${projectId}_v${version}.zip`}
      rel="noreferrer"
      onClick={closeDropdown}
      {...props}
    >
      <Icon type="cloud-download" fw /> {t('history_download_this_version')}
    </MenuItem>
  )
}

export default Download
