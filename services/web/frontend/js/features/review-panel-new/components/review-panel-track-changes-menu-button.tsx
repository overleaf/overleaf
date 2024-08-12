import { FC, memo } from 'react'
import { Trans } from 'react-i18next'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import Icon from '@/shared/components/icon'

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
      <Icon type={menuExpanded ? 'angle-down' : 'angle-right'} />
    </button>
  )
}

export default memo(ReviewPanelTrackChangesMenuButton)
