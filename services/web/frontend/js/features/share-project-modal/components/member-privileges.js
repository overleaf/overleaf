import React from 'react'
import PropTypes from 'prop-types'
import { Trans } from 'react-i18next'

export default function MemberPrivileges({ privileges }) {
  switch (privileges) {
    case 'readAndWrite':
      return <Trans i18nKey="can_edit" />

    case 'readOnly':
      return <Trans i18nKey="read_only" />

    default:
      return null
  }
}
MemberPrivileges.propTypes = {
  privileges: PropTypes.string.isRequired,
}
