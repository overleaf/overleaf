import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useShareProjectContext } from './share-project-modal'
import TransferOwnershipModal from './transfer-ownership-modal'
import { removeMemberFromProject, updateMember } from '../utils/api'
import { Button, Col, Form, FormControl, FormGroup } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useProjectContext } from '../../../shared/context/project-context'
import { sendMB } from '../../../infrastructure/event-tracking'

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
    <Form horizontal id="share-project-form" onSubmit={handleSubmit}>
      <FormGroup className="project-member row">
        <Col xs={7}>
          <FormControl.Static>{member.email}</FormControl.Static>
        </Col>

        <Col xs={3}>
          <SelectPrivilege
            value={privileges}
            handleChange={event => setPrivileges(event.target.value)}
          />
        </Col>

        <Col xs={2}>
          {privileges === member.privileges ? (
            <RemoveMemberAction member={member} />
          ) : (
            <ChangePrivilegesActions
              handleReset={() => setPrivileges(member.privileges)}
            />
          )}
        </Col>
      </FormGroup>
    </Form>
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
    <FormControl
      componentClass="select"
      className="privileges"
      bsSize="sm"
      value={value}
      onChange={handleChange}
    >
      <option value="owner">{t('owner')}</option>
      <option value="readAndWrite">{t('can_edit')}</option>
      <option value="readOnly">{t('read_only')}</option>
    </FormControl>
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
    <FormControl.Static className="text-center">
      <Tooltip
        id="remove-collaborator"
        description={t('remove_collaborator')}
        overlayProps={{ placement: 'bottom' }}
      >
        <Button
          type="button"
          bsStyle="link"
          onClick={handleClick}
          className="remove-button"
          aria-label={t('remove_collaborator')}
        >
          <Icon type="times" />
        </Button>
      </Tooltip>
    </FormControl.Static>
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
      <Button type="submit" bsSize="sm" bsStyle="primary">
        {t('change_or_cancel-change')}
      </Button>
      <div className="text-sm">
        {t('change_or_cancel-or')}
        &nbsp;
        <Button type="button" className="btn-inline-link" onClick={handleReset}>
          {t('change_or_cancel-cancel')}
        </Button>
      </div>
    </div>
  )
}

ChangePrivilegesActions.propTypes = {
  handleReset: PropTypes.func.isRequired,
}
