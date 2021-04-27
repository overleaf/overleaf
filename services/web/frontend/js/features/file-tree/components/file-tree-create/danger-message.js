import React from 'react'
import PropTypes from 'prop-types'
import { Alert } from 'react-bootstrap'

export default function DangerMessage({ children }) {
  return <Alert bsStyle="danger">{children}</Alert>
}
DangerMessage.propTypes = {
  children: PropTypes.string.isRequired,
}
