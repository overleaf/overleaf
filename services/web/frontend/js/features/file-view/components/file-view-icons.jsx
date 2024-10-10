import Icon from '../../../shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

export const LinkedFileIcon = props => {
  return (
    <BootstrapVersionSwitcher
      bs3={
        <Icon
          type="external-link-square"
          modifier="rotate-180"
          className="linked-file-icon"
          {...props}
        />
      }
      bs5={
        <MaterialIcon
          type="open_in_new"
          modifier="rotate-180"
          className="align-middle linked-file-icon"
          {...props}
        />
      }
    />
  )
}
