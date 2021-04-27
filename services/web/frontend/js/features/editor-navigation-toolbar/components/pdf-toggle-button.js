import React from 'react'
import PropTypes from 'prop-types'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import classNames from 'classnames'
import Icon from '../../../shared/components/icon'

function PdfToggleButton({ onClick, pdfViewIsOpen }) {
  const classes = classNames(
    'btn',
    'btn-full-height',
    'btn-full-height-no-border',
    {
      active: pdfViewIsOpen,
    }
  )

  return (
    <OverlayTrigger
      placement="bottom"
      trigger={['hover', 'focus']}
      overlay={<Tooltip id="tooltip-online-user">PDF</Tooltip>}
    >
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/interactive-supports-focus */}
      <a role="button" className={classes} onClick={onClick}>
        <Icon type="file-pdf-o" modifier="fw" />
      </a>
    </OverlayTrigger>
  )
}

PdfToggleButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  pdfViewIsOpen: PropTypes.bool,
}

export default PdfToggleButton
