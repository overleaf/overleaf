import { DropdownDivider } from '@/shared/components/dropdown/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { useEditorPropertiesContext } from '../../context/editor-properties-context'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
import { sendMB } from '@/infrastructure/event-tracking'
import { useIdeReactContext } from '../../context/ide-react-context'
import { usePermissionsContext } from '../../context/permissions-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorContext } from '@/shared/context/editor-context'
import { NestedMenuBarDropdown } from '@/shared/components/menu-bar/menu-bar-dropdown'
import { useUserContext } from '@/shared/context/user-context'

function getMode(permissionsLevel: string, wantTrackChanges: boolean) {
  if (permissionsLevel === 'readOnly') {
    return 'view'
  }
  if (permissionsLevel === 'review') {
    return 'review'
  }
  if (wantTrackChanges) {
    return 'review'
  }
  return 'edit'
}

const ReviewModeOptions: React.FC = () => {
  const { t } = useTranslation()
  const { wantTrackChanges } = useEditorPropertiesContext()
  const { write, trackedWrite } = usePermissionsContext()
  const { permissionsLevel } = useIdeReactContext()
  const { features } = useProjectContext()
  const { setUpgradeTrackChangesModal } = useEditorContext()
  const user = useUserContext()

  const mode = getMode(permissionsLevel, wantTrackChanges)
  const showViewOption = mode === 'view'

  if (!features.trackChangesVisible) {
    return null
  }

  return (
    <>
      <DropdownDivider />
      <NestedMenuBarDropdown id="editing-mode-group" title={t('editing_mode')}>
        <OLDropdownMenuItem
          as="button"
          disabled={!write || !user.id}
          onClick={() => {
            if (mode === 'edit') {
              return
            }
            sendMB('editing-mode-change', {
              role: permissionsLevel,
              previousMode: mode,
              newMode: 'edit',
            })
            window.dispatchEvent(new Event('toggle-track-changes'))
          }}
          leadingIcon="edit"
          active={write && mode === 'edit'}
        >
          {t('editing')}
        </OLDropdownMenuItem>
        <OLDropdownMenuItem
          as="button"
          disabled={permissionsLevel === 'readOnly' || !user.id}
          onClick={() => {
            if (mode === 'review') {
              return
            }
            if (!features.trackChanges) {
              setUpgradeTrackChangesModal({
                show: true,
                location: 'menu-bar',
              })
            } else {
              sendMB('editing-mode-change', {
                role: permissionsLevel,
                previousMode: mode,
                newMode: mode,
              })
              window.dispatchEvent(new Event('toggle-track-changes'))
            }
          }}
          leadingIcon="rate_review"
          active={trackedWrite && mode === 'review'}
        >
          {t('reviewing')}
        </OLDropdownMenuItem>
        {showViewOption && (
          <OLDropdownMenuItem
            as="button"
            leadingIcon="visibility"
            active={mode === 'view'}
          >
            {t('viewing')}
          </OLDropdownMenuItem>
        )}
      </NestedMenuBarDropdown>
    </>
  )
}

export default ReviewModeOptions
