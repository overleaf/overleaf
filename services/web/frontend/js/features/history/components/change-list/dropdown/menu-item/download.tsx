import { useTranslation } from 'react-i18next'
import { MenuItem, MenuItemProps } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import * as location from '../../../../../../shared/components/location'

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

  const handleDownloadVersion = (e: React.MouseEvent<MenuItemProps>) => {
    e.preventDefault()
    closeDropdown()
    const event = e as typeof e & { target: HTMLAnchorElement }
    location.assign(event.target.href)
  }

  return (
    <MenuItem
      href={`/project/${projectId}/version/${version}/zip`}
      target="_blank"
      rel="noreferrer"
      onClick={handleDownloadVersion}
      {...props}
    >
      <Icon type="cloud-download" fw /> {t('history_download_this_version')}
    </MenuItem>
  )
}

export default Download
