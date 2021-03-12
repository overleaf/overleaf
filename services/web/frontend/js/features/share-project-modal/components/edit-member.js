import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import {
  useProjectContext,
  useShareProjectContext
} from './share-project-modal'
import Icon from '../../../shared/components/icon'
import TransferOwnershipModal from './transfer-ownership-modal'
import {
  Button,
  Col,
  Form,
  FormControl,
  FormGroup,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap'
import { removeMemberFromProject, updateMember } from '../utils/api'

export default function EditMember({ member }) {
  const [privileges, setPrivileges] = useState(member.privileges)
  const [
    confirmingOwnershipTransfer,
    setConfirmingOwnershipTransfer
  ] = useState(false)

  const { updateProject, monitorRequest } = useShareProjectContext()
  const project = useProjectContext()

  function handleSubmit(event) {
    event.preventDefault()

    if (privileges === 'owner') {
      setConfirmingOwnershipTransfer(true)
    } else {
      monitorRequest(() =>
        updateMember(project, member, {
          privilegeLevel: privileges
        })
      ).then(() => {
        updateProject({
          members: project.members.map(item =>
            item._id === member._id ? { ...item, privileges } : item
          )
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
      <FormGroup className="project-member">
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
    privileges: PropTypes.string.isRequired
  })
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
  handleChange: PropTypes.func.isRequired
}

function RemoveMemberAction({ member }) {
  const { updateProject, monitorRequest } = useShareProjectContext()
  const project = useProjectContext()

  function handleClick(event) {
    event.preventDefault()

    monitorRequest(() => removeMemberFromProject(project, member)).then(() => {
      updateProject({
        members: project.members.filter(existing => existing !== member)
      })
    })
  }

  return (
    <FormControl.Static className="text-center">
      <OverlayTrigger
        placement="bottom"
        overlay={
          <Tooltip id="tooltip-remove-collaborator">
            <Trans i18nKey="remove_collaborator" />
          </Tooltip>
        }
      >
        <Button
          type="button"
          bsStyle="link"
          onClick={handleClick}
          className="remove-button"
          aria-label="Remove from project"
        >
          <Icon type="times" />
        </Button>
      </OverlayTrigger>
    </FormControl.Static>
  )
}
RemoveMemberAction.propTypes = {
  member: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    privileges: PropTypes.string.isRequired
  })
}

function ChangePrivilegesActions({ handleReset }) {
  return (
    <div className="text-center">
      <Button type="submit" bsSize="sm" bsStyle="success">
        <Trans i18nKey="change_or_cancel-change" />
      </Button>
      <div className="text-sm">
        <Trans i18nKey="change_or_cancel-or" />
        &nbsp;
        <Button type="button" className="btn-inline-link" onClick={handleReset}>
          <Trans i18nKey="change_or_cancel-cancel" />
        </Button>
      </div>
    </div>
  )
}
ChangePrivilegesActions.propTypes = {
  handleReset: PropTypes.func.isRequired
}
