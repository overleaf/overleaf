import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import Notification from '@/shared/components/notification'
import MaterialIcon from '@/shared/components/material-icon'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import { requestAccess } from '@/features/share-project-modal/utils/api'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import useAsync from '@/shared/hooks/use-async'
import { RequestedPrivilegeLevel } from '@/shared/context/types/project-metadata'

// `as const` keeps the icon names as literals so they satisfy
// MaterialIcon's `type` prop when combined with `unfilled` (a widened
// `string` would resolve to the filled-icon overload and fail type-check).
const LEVEL_OPTIONS = [
  { key: 'readAndWrite', icon: 'edit' },
  { key: 'review', icon: 'mode_comment' },
] as const satisfies ReadonlyArray<{
  key: RequestedPrivilegeLevel
  icon: string
}>

export default function RequestAccessModal({
  show,
  onSuccess,
  onCancel,
}: {
  show: boolean
  onSuccess: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()
  const { email } = useUserContext()
  const { permissionsLevel } = useIdeReactContext()
  const { isLoading, isError, runAsync } = useAsync()

  // Reviewers can only step up to editor; viewers can choose editor or
  // reviewer. The requestable set always excludes the level the user
  // already holds.
  const options =
    permissionsLevel === 'review'
      ? LEVEL_OPTIONS.filter(o => o.key === 'readAndWrite')
      : LEVEL_OPTIONS

  const [privilegeLevel, setPrivilegeLevel] =
    useState<RequestedPrivilegeLevel>('readAndWrite')

  // Built with static t() calls (not t(dynamicKey)) so the keys are picked up
  // by the translation extractor and never render as raw key strings.
  const levelLabels: Record<RequestedPrivilegeLevel, string> = {
    readAndWrite: t('editor'),
    review: t('reviewer'),
  }

  function submit() {
    runAsync(requestAccess(projectId, privilegeLevel))
      .then(() => onSuccess())
      .catch(() => {})
  }

  return (
    <OLModal show={show} onHide={onCancel}>
      <OLModalHeader>
        <OLModalTitle>{t('request_edit_access')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>{t('signed_in_as_email', { email })}</p>
        <OLFormGroup>
          <OLFormLabel>{t('what_access_do_you_want')}</OLFormLabel>
          <div>
            <OLDropdown
              onSelect={(eventKey: RequestedPrivilegeLevel) =>
                eventKey && setPrivilegeLevel(eventKey)
              }
            >
              <OLDropdownToggle
                variant="ghost"
                disabled={isLoading}
                className="d-flex align-items-center gap-2 no-default-caret"
              >
                {levelLabels[privilegeLevel]}
                <MaterialIcon type="keyboard_arrow_down" />
              </OLDropdownToggle>
              <OLDropdownMenu>
                {options.map(option => (
                  <DropdownMenuItem
                    key={option.key}
                    as="button"
                    eventKey={option.key}
                    leadingIcon={<MaterialIcon type={option.icon} unfilled />}
                    active={privilegeLevel === option.key}
                    trailingIcon={
                      privilegeLevel === option.key ? 'check' : undefined
                    }
                  >
                    {levelLabels[option.key]}
                  </DropdownMenuItem>
                ))}
              </OLDropdownMenu>
            </OLDropdown>
          </div>
        </OLFormGroup>
        <p className="text-muted small mb-0">
          {t(
            'your_name_and_email_address_will_be_visible_to_the_project_owner_and_other_editors'
          )}
        </p>
        {isError && (
          <Notification
            type="error"
            content={t('generic_something_went_wrong')}
            className="mb-0 mt-3"
          />
        )}
      </OLModalBody>
      <OLModalFooter>
        <div className="me-auto">{isLoading && <OLSpinner size="sm" />}</div>
        <OLButton variant="secondary" onClick={onCancel} disabled={isLoading}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="primary" onClick={submit} disabled={isLoading}>
          {t('send_request')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
