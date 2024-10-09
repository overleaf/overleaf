import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useShareProjectContext } from './share-project-modal'
import TransferOwnershipModal from './transfer-ownership-modal'
import { removeMemberFromProject, updateMember } from '../utils/api'
import Icon from '../../../shared/components/icon'
import { useProjectContext } from '../../../shared/context/project-context'
import { sendMB } from '../../../infrastructure/event-tracking'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLFormSelect from '@/features/ui/components/ol/ol-form-select'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'

export default function EditMember({ member }) {
  const [privileges, setPrivileges] = useState(member.privileges)
  const [confirmingOwnershipTransfer, setConfirmingOwnershipTransfer] =
    useState(false)

  // update the local state if the member's privileges change externally
  useEffect(() => {
    setPrivileges(member.privileges)
  }, [member.privileges])

  const { updateProject, monitorRequest } = useShareProjectContext()
  const { _id: projectId, members } = useProjectContext()

  function handleSubmit(event) {
    event.preventDefault()

    if (privileges === 'owner') {
      setConfirmingOwnershipTransfer(true)
    } else {
      monitorRequest(() =>
        updateMember(projectId, member, {
          privilegeLevel: privileges,
        })
      ).then(() => {
        updateProject({
          members: members.map(item =>
            item._id === member._id ? { ...item, privileges } : item
          ),
        })
      })
    }
  }

  if (confirmingOwnershipTransfer) {
    return (
      <TransferOwnershipModal
        member={member}
        cancel={() => setConfirmingOwnershipTransfer(false)}
      />
    )
  }

  return (
    <form
      id="share-project-form"
      className={bsVersion({ bs3: 'form-horizontal' })}
      onSubmit={handleSubmit}
    >
      <OLFormGroup className="project-member row">
        <OLCol xs={7} className={bsVersion({ bs3: 'pt-1', bs5: 'pt-2' })}>
          {member.email}
        </OLCol>

        <OLCol xs={3}>
          <SelectPrivilege
            value={privileges}
            handleChange={event => setPrivileges(event.target.value)}
          />
        </OLCol>

        <OLCol xs={2}>
          {privileges === member.privileges ? (
            <RemoveMemberAction member={member} />
          ) : (
            <ChangePrivilegesActions
              handleReset={() => setPrivileges(member.privileges)}
            />
          )}
        </OLCol>
      </OLFormGroup>
    </form>
  )
}
EditMember.propTypes = {
  member: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    privileges: PropTypes.string.isRequired,
  }),
}

function SelectPrivilege({ value, handleChange }) {
  const { t } = useTranslation()

  return (
    <OLFormSelect
      className="privileges"
      value={value}
      onChange={handleChange}
      bs3Props={{
        bsSize: 'sm',
      }}
    >
      <option value="owner">{t('owner')}</option>
      <option value="readAndWrite">{t('can_edit')}</option>
      <option value="readOnly">{t('read_only')}</option>
    </OLFormSelect>
  )
}

SelectPrivilege.propTypes = {
  value: PropTypes.string.isRequired,
  handleChange: PropTypes.func.isRequired,
}

function RemoveMemberAction({ member }) {
  const { t } = useTranslation()
  const { updateProject, monitorRequest } = useShareProjectContext()
  const { _id: projectId, members, invites } = useProjectContext()

  function handleClick(event) {
    event.preventDefault()

    monitorRequest(() => removeMemberFromProject(projectId, member)).then(
      () => {
        const updatedMembers = members.filter(existing => existing !== member)
        updateProject({
          members: updatedMembers,
        })
        sendMB('collaborator-removed', {
          project_id: projectId,
          current_collaborators_amount: updatedMembers.length,
          current_invites_amount: invites.length,
        })
      }
    )
  }

  return (
    <div className="text-center">
      <OLTooltip
        id="remove-collaborator"
        description={t('remove_collaborator')}
        overlayProps={{ placement: 'bottom' }}
      >
        <OLButton
          variant="link"
          onClick={handleClick}
          className="remove-button"
          aria-label={t('remove_collaborator')}
        >
          <BootstrapVersionSwitcher
            bs3={<Icon type="times" />}
            bs5={<MaterialIcon type="clear" />}
          />
        </OLButton>
      </OLTooltip>
    </div>
  )
}

RemoveMemberAction.propTypes = {
  member: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    privileges: PropTypes.string.isRequired,
  }),
}

function ChangePrivilegesActions({ handleReset }) {
  const { t } = useTranslation()

  return (
    <div className="text-center">
      <OLButton type="submit" size="sm" variant="primary">
        {t('change_or_cancel-change')}
      </OLButton>
      <div className="text-sm">
        {t('change_or_cancel-or')}
        &nbsp;
        <OLButton
          variant="link"
          className="btn-inline-link"
          onClick={handleReset}
        >
          {t('change_or_cancel-cancel')}
        </OLButton>
      </div>
    </div>
  )
}

ChangePrivilegesActions.propTypes = {
  handleReset: PropTypes.func.isRequired,
}
