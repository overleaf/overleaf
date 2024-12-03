import { useTranslation } from 'react-i18next'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
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
    <OLDropdownMenuItem
      href={`/project/${projectId}/version/${version}/zip`}
      download={`${projectId}_v${version}.zip`}
      rel="noreferrer"
      onClick={closeDropdown}
      leadingIcon={
        <BootstrapVersionSwitcher
          bs3={<Icon type="cloud-download" fw />}
          bs5={<MaterialIcon type="download" />}
        />
      }
      {...props}
    >
      {t('history_download_this_version')}
    </OLDropdownMenuItem>
  )
}

export default Download
