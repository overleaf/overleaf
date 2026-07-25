import { useMemo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMultipleSelection } from 'downshift'
import { Select } from '@/shared/components/select'
import ClickableElementEnhancer from '@/shared/components/clickable-element-enhancer'
import OLButton from '@/shared/components/ol/ol-button'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'
import { useProjectContext } from '@/shared/context/project-context'
import {
  resendInvite,
  sendInvite,
} from '@/features/share-project-modal/utils/api'
import { ContactItem } from '@/features/share-project-modal/components/select-collaborators'
import { useShareProjectContext } from '@/features/share-project-modal/components/share-project-modal'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { sendMB } from '@/infrastructure/event-tracking'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import { isValidEmail } from '@/shared/utils/email'

type AddCollaboratorsSelectProps = {
  readOnly?: boolean
  multipleSelectionProps: ReturnType<typeof useMultipleSelection<ContactItem>>
  currentMemberEmails: string[]
  inputValue?: string
  onInviteSuccess?: () => void
  hasErrors?: boolean
}

function AddCollaboratorsSelect({
  readOnly,
  multipleSelectionProps,
  currentMemberEmails,
  inputValue,
  onInviteSuccess,
  hasErrors,
}: AddCollaboratorsSelectProps) {
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  const { t } = useTranslation()
  const { features } = useProjectContext()
  const [privileges, setPrivileges] = useState<PermissionsLevel>('readAndWrite')

  const isMounted = useIsMounted()

  const { setInFlight, setError } = useShareProjectContext()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { projectId, project, updateProject } = useProjectContext()
  const { members, invites } = project || {}

  const privilegeOptions = useMemo(() => {
    const options: {
      key: PermissionsLevel
      label: string
      description?: string | null
      icon: AvailableUnfilledIcon
    }[] = [
      {
        key: 'readAndWrite',
        label: t('editor'),
        icon: 'edit',
      },
    ]

    if (features.trackChangesVisible) {
      options.push({
        key: 'review',
        label: t('reviewer'),
        description: !features.trackChanges
          ? t('comment_only_upgrade_for_track_changes')
          : null,
        icon: 'mode_comment',
      })
    }

    options.push({
      key: 'readOnly',
      label: t('viewer'),
      icon: 'visibility',
    })

    return options
  }, [features.trackChanges, features.trackChangesVisible, t])

  const { reset, selectedItems } = multipleSelectionProps

  useEffect(() => {
    if (readOnly && privileges !== 'readOnly') {
      setPrivileges('readOnly')
    }
  }, [privileges, readOnly])

  const handleSubmit = useCallback(async () => {
    if (!selectedItems.length) {
      return
    }

    // reset the selected items
    reset()

    setError(undefined)
    if (isSharingUpdatesEnabled) {
      setIsSubmitting(true)
    } else {
      setInFlight(true)
    }

    let hasError = false
    let hasInvited = false

    for (const contact of selectedItems) {
      // unmounting means can't add any more collaborators
      if (!isMounted.current) {
        break
      }

      const email = contact.type === 'user' ? contact.email : contact.display
      const normalisedEmail = email.toLowerCase()

      if (currentMemberEmails.includes(normalisedEmail)) {
        continue
      }

      let data

      try {
        const invite = invites?.find(invite => invite.email === normalisedEmail)

        if (invite) {
          data = await resendInvite(projectId, invite)
        } else {
          data = await sendInvite(projectId, email, privileges)
        }

        const role = data?.invite?.privileges
        const membersAndInvites = (members || []).concat(invites || [])
        const previousEditorsAmount = membersAndInvites.filter(
          member => member.privileges === 'readAndWrite'
        ).length
        const previousReviewersAmount = membersAndInvites.filter(
          member => member.privileges === 'review'
        ).length
        const previousViewersAmount = membersAndInvites.filter(
          member => member.privileges === 'readOnly'
        ).length

        sendMB('collaborator-invited', {
          project_id: projectId,
          // invitation is only populated on successful invite, meaning that for paywall and other cases this will be null
          successful_invite: !!data.invite,
          users_updated: !!(data.users || data.user),
          current_collaborators_amount: members?.length || 0,
          current_invites_amount: invites?.length || 0,
          role,
          previousEditorsAmount,
          previousReviewersAmount,
          previousViewersAmount,
          newEditorsAmount:
            role === 'readAndWrite'
              ? previousEditorsAmount + 1
              : previousEditorsAmount,
          newReviewersAmount:
            role === 'review'
              ? previousReviewersAmount + 1
              : previousReviewersAmount,
          newViewersAmount:
            role === 'readOnly'
              ? previousViewersAmount + 1
              : previousViewersAmount,
        })
      } catch (error: any) {
        hasError = true
        if (isSharingUpdatesEnabled) {
          setIsSubmitting(false)
        } else {
          setInFlight(false)
        }
        setError(
          error.data?.errorReason ||
            (error.response?.status === 429
              ? 'too_many_requests'
              : 'generic_something_went_wrong')
        )
        break
      }

      if (data.error) {
        hasError = true
        setError(data.error)
        if (isSharingUpdatesEnabled) {
          setIsSubmitting(false)
        } else {
          setInFlight(false)
        }
      } else if (data.invite) {
        hasInvited = true
        updateProject({
          invites: invites?.concat(data.invite) || [data.invite],
        })
      } else if (data.users) {
        hasInvited = true
        updateProject({
          members: members?.concat(data.users) || data.users,
        })
      } else if (data.user) {
        hasInvited = true
        updateProject({
          members: members?.concat(data.user) || [data.user],
        })
      } else if (!('invite' in data)) {
        // a successful resend returns an empty body (no `invite` field)
        hasInvited = true
      } else {
        hasError = true
        setError('generic_something_went_wrong')
        if (isSharingUpdatesEnabled) {
          setIsSubmitting(false)
        } else {
          setInFlight(false)
        }
      }

      // wait for a short time, so canAddCollaborators has time to update with new collaborator information
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (isSharingUpdatesEnabled) {
      setIsSubmitting(false)
    } else {
      setInFlight(false)
    }

    if (!hasError && hasInvited) {
      onInviteSuccess?.()
    }
  }, [
    currentMemberEmails,
    invites,
    isMounted,
    isSharingUpdatesEnabled,
    members,
    onInviteSuccess,
    privileges,
    projectId,
    reset,
    selectedItems,
    setError,
    setInFlight,
    updateProject,
  ])

  const canInvite =
    !hasErrors &&
    ((inputValue &&
      isValidEmail(inputValue) &&
      !currentMemberEmails.includes(inputValue.toLowerCase())) ||
      selectedItems.length > 0)

  const showPermissionsSelect = Boolean(inputValue) || selectedItems.length > 0

  const permissionComponent = (
    <Select
      dataTestId="add-collaborator-select"
      items={privilegeOptions}
      itemToKey={item => item.key}
      itemToString={item => item?.label || ''}
      itemToSubtitle={item => item?.description || ''}
      itemToDisabled={item => !!(readOnly && item?.key !== 'readOnly')}
      itemToLeadingIcon={item =>
        isSharingUpdatesEnabled &&
        item && <MaterialIcon type={item.icon} unfilled />
      }
      selected={privilegeOptions.find(option => option.key === privileges)}
      onSelectedItemChanged={item => {
        if (item) {
          setPrivileges(item.key)
        }
      }}
      selectedIcon={isSharingUpdatesEnabled}
      size={isSharingUpdatesEnabled ? 'lg' : undefined}
    />
  )

  return (
    <>
      {isSharingUpdatesEnabled
        ? showPermissionsSelect
          ? permissionComponent
          : null
        : permissionComponent}
      <ClickableElementEnhancer
        as={OLButton}
        onClick={handleSubmit}
        variant="primary"
        size={isSharingUpdatesEnabled ? 'lg' : undefined}
        disabled={isSharingUpdatesEnabled && !canInvite}
        isLoading={isSharingUpdatesEnabled && isSubmitting}
      >
        {t('invite')}
      </ClickableElementEnhancer>
    </>
  )
}

export default AddCollaboratorsSelect
