import Icon from '@/shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

export default function OLTagIcon() {
  return (
    <BootstrapVersionSwitcher
      bs3={<Icon type="tag" fw />}
      bs5={<MaterialIcon type="sell" />}
    />
  )
}
