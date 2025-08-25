import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMultipleSelection } from 'downshift'
import { useShareProjectContext } from './share-project-modal'
import SelectCollaborators, { ContactItem } from './select-collaborators'
import { resendInvite, sendInvite } from '../utils/api'
import { useUserContacts } from '../hooks/use-user-contacts'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB } from '@/infrastructure/event-tracking'
import ClickableElementEnhancer from '@/shared/components/clickable-element-enhancer'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import { Select } from '@/shared/components/select'
import OLButton from '@/shared/components/ol/ol-button'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'
import OLFormText from '@/shared/components/ol/ol-form-text'

export default function AddCollaborators({ readOnly }: { readOnly?: boolean }) {
  const [privileges, setPrivileges] = useState<PermissionsLevel>('readAndWrite')

  const isMounted = useIsMounted()

  const { data: contacts } = useUserContacts()

  const { t } = useTranslation()

  const { setInFlight, setError } = useShareProjectContext()

  const { projectId, project, features, updateProject } = useProjectContext()
  const { members, invites } = project || {}

  const currentMemberEmails = useMemo(
    () => (members || []).map(member => member.email).sort(),
    [members]
  )

  const nonMemberContacts = useMemo(() => {
    if (!contacts) {
      return null
    }

    return contacts.filter(
      contact => !currentMemberEmails.includes(contact.email)
    )
  }, [contacts, currentMemberEmails])

  const multipleSelectionProps = useMultipleSelection<ContactItem>({
    initialActiveIndex: 0,
    initialSelectedItems: [],
  })

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
    setInFlight(true)

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
        setInFlight(false)
        setError(
          error.data?.errorReason ||
            (error.response?.status === 429
              ? 'too_many_requests'
              : 'generic_something_went_wrong')
        )
        break
      }

      if (data.error) {
        setError(data.error)
        setInFlight(false)
      } else if (data.invite) {
        updateProject({
          invites: invites?.concat(data.invite) || [data.invite],
        })
      } else if (data.users) {
        updateProject({
          members: members?.concat(data.users) || data.users,
        })
      } else if (data.user) {
        updateProject({
          members: members?.concat(data.user) || [data.user],
        })
      }

      // wait for a short time, so canAddCollaborators has time to update with new collaborator information
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    setInFlight(false)
  }, [
    currentMemberEmails,
    invites,
    isMounted,
    members,
    privileges,
    projectId,
    reset,
    selectedItems,
    setError,
    setInFlight,
    updateProject,
  ])

  const privilegeOptions = useMemo(() => {
    const options: {
      key: PermissionsLevel
      label: string
      description?: string | null
    }[] = [
      {
        key: 'readAndWrite',
        label: t('editor'),
      },
    ]

    if (features.trackChangesVisible) {
      options.push({
        key: 'review',
        label: t('reviewer'),
        description: !features.trackChanges
          ? t('comment_only_upgrade_for_track_changes')
          : null,
      })
    }

    options.push({
      key: 'readOnly',
      label: t('viewer'),
    })

    return options
  }, [features.trackChanges, features.trackChangesVisible, t])

  return (
    <OLForm className="add-collabs">
      <OLFormGroup>
        <SelectCollaborators
          loading={!nonMemberContacts}
          options={nonMemberContacts || []}
          multipleSelectionProps={multipleSelectionProps}
        />
        <OLFormText id="add-collaborator-help-text">
          {t('add_comma_separated_emails_help')}
        </OLFormText>
      </OLFormGroup>
      <OLFormGroup>
        <div className="float-end add-collaborator-controls">
          <Select
            dataTestId="add-collaborator-select"
            items={privilegeOptions}
            itemToKey={item => item.key}
            itemToString={item => item?.label || ''}
            itemToSubtitle={item => item?.description || ''}
            itemToDisabled={item => !!(readOnly && item?.key !== 'readOnly')}
            selected={privilegeOptions.find(
              option => option.key === privileges
            )}
            onSelectedItemChanged={item => {
              if (item) {
                setPrivileges(item.key)
              }
            }}
          />
          <ClickableElementEnhancer
            as={OLButton}
            onClick={handleSubmit}
            variant="primary"
          >
            {t('invite')}
          </ClickableElementEnhancer>
        </div>
      </OLFormGroup>
    </OLForm>
  )
}
