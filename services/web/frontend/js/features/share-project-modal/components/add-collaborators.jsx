import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMultipleSelection } from 'downshift'
import { useShareProjectContext } from './share-project-modal'
import SelectCollaborators from './select-collaborators'
import { resendInvite, sendInvite } from '../utils/api'
import { useUserContacts } from '../hooks/use-user-contacts'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB } from '@/infrastructure/event-tracking'
import ClickableElementEnhancer from '@/shared/components/clickable-element-enhancer'
import PropTypes from 'prop-types'
import OLForm from '@/features/ui/components/ol/ol-form'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormSelect from '@/features/ui/components/ol/ol-form-select'
import OLButton from '@/features/ui/components/ol/ol-button'
import getMeta from '@/utils/meta'

export default function AddCollaborators({ readOnly }) {
  const [privileges, setPrivileges] = useState('readAndWrite')

  const isMounted = useIsMounted()

  const { data: contacts } = useUserContacts()

  const { t } = useTranslation()

  const { updateProject, setInFlight, setError } = useShareProjectContext()

  const { _id: projectId, members, invites } = useProjectContext()

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

  const multipleSelectionProps = useMultipleSelection({
    initialActiveIndex: 0,
    initialSelectedItems: [],
  })

  const { reset, selectedItems } = multipleSelectionProps

  useEffect(() => {
    if (readOnly && privileges === 'readAndWrite') {
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
        const invite = (invites || []).find(
          invite => invite.email === normalisedEmail
        )

        if (invite) {
          data = await resendInvite(projectId, invite)
        } else {
          data = await sendInvite(projectId, email, privileges)
        }

        sendMB('collaborator-invited', {
          project_id: projectId,
          // invitation is only populated on successful invite, meaning that for paywall and other cases this will be null
          successful_invite: !!data.invite,
          users_updated: !!(data.users || data.user),
          current_collaborators_amount: members.length,
          current_invites_amount: invites.length,
        })
      } catch (error) {
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
          invites: invites.concat(data.invite),
        })
      } else if (data.users) {
        updateProject({
          members: members.concat(data.users),
        })
      } else if (data.user) {
        updateProject({
          members: members.concat(data.user),
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

  return (
    <OLForm className="add-collabs">
      <OLFormGroup>
        <SelectCollaborators
          loading={!nonMemberContacts}
          options={nonMemberContacts || []}
          placeholder="Email, comma separated"
          multipleSelectionProps={multipleSelectionProps}
        />
      </OLFormGroup>

      <OLFormGroup>
        <div className="pull-right">
          <OLFormSelect
            className="privileges"
            value={privileges}
            onChange={event => setPrivileges(event.target.value)}
            bs3Props={{
              bsSize: 'sm',
            }}
          >
            <option disabled={readOnly} value="readAndWrite">
              {t('can_edit')}
            </option>
            {getMeta('ol-isReviewerRoleEnabled') && (
              <option value="review">{t('can_review')}</option>
            )}
            <option value="readOnly">{t('can_view')}</option>
          </OLFormSelect>
          <span>&nbsp;&nbsp;</span>
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

AddCollaborators.propTypes = {
  readOnly: PropTypes.bool,
}
