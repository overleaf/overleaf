import { FC, memo } from 'react'
import { Trans } from 'react-i18next'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import Icon from '@/shared/components/icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

const ReviewPanelTrackChangesMenuButton: FC<{
  menuExpanded: boolean
  setMenuExpanded: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ menuExpanded, setMenuExpanded }) => {
  const { wantTrackChanges } = useEditorManagerContext()

  return (
    <button
      className="track-changes-menu-button"
      onClick={() => setMenuExpanded(value => !value)}
    >
      {wantTrackChanges && <div className="track-changes-indicator-circle" />}
      {wantTrackChanges ? (
        <Trans
          i18nKey="track_changes_is_on"
          components={{ strong: <strong /> }}
        />
      ) : (
        <Trans
          i18nKey="track_changes_is_off"
          components={{ strong: <strong /> }}
        />
      )}
      <BootstrapVersionSwitcher
        bs3={<Icon type={menuExpanded ? 'angle-down' : 'angle-right'} />}
        bs5={
          <MaterialIcon type={menuExpanded ? 'expand_more' : 'chevron_right'} />
        }
      />
    </button>
  )
}

export default memo(ReviewPanelTrackChangesMenuButton)
