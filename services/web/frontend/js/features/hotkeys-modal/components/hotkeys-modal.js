import React from 'react'
import { Button, Modal, Row, Col } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import AccessibleModal from '../../../shared/components/accessible-modal'

export default function HotkeysModal({
  animation = true,
  handleHide,
  show,
  isMac = false,
  trackChangesVisible = false,
}) {
  const { t } = useTranslation()

  const ctrl = isMac ? 'Cmd' : 'Ctrl'

  return (
    <AccessibleModal
      bsSize="large"
      onHide={handleHide}
      show={show}
      animation={animation}
    >
      <Modal.Header closeButton>
        <Modal.Title>{t('hotkeys')}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="modal-hotkeys">
        <h3>{t('common')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + F`}
              description="Find (and replace)"
            />
            <Hotkey combination={`${ctrl} + Enter`} description="Compile" />
          </Col>
          <Col xs={4}>
            <Hotkey combination={`${ctrl} + Z`} description="Undo" />
          </Col>
          <Col xs={4}>
            <Hotkey combination={`${ctrl} + Y`} description="Redo" />
          </Col>
        </Row>

        <h3>{t('navigation')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + Home`}
              description="Beginning of document"
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + End`}
              description="End of document"
            />
          </Col>
          <Col xs={4}>
            <Hotkey combination={`${ctrl} + L`} description="Go To Line" />
          </Col>
        </Row>

        <h3>{t('editing')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey combination={`${ctrl} + /`} description="Toggle Comment" />
            <Hotkey
              combination={`${ctrl} + D`}
              description="Delete Current Line"
            />
            <Hotkey combination={`${ctrl} + A`} description="Select All" />
          </Col>

          <Col xs={4}>
            <Hotkey combination={`${ctrl} + U`} description="To Uppercase" />
            <Hotkey
              combination={`${ctrl} + Shift + U`}
              description="To Lowercase"
            />
            <Hotkey combination="Tab" description="Indent Selection" />
          </Col>

          <Col xs={4}>
            <Hotkey combination={`${ctrl} + B`} description="Bold text" />
            <Hotkey combination={`${ctrl} + I`} description="Italic Text" />
          </Col>
        </Row>

        <h3>{t('autocomplete')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + Space`}
              description="Autocomplete Menu"
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination="Tab / Up / Down"
              description="Select Candidate"
            />
          </Col>
          <Col xs={4}>
            <Hotkey combination="Enter" description="Insert Candidate" />
          </Col>
        </Row>

        <h3>
          <Trans
            i18nKey="autocomplete_references"
            components={{ code: <code /> }}
          />
        </h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + Space `}
              description="Search References"
            />
          </Col>
        </Row>

        {trackChangesVisible && (
          <>
            <h3>{t('review')}</h3>

            <Row>
              <Col xs={4}>
                <Hotkey
                  combination={`${ctrl} + J`}
                  description="Toggle review panel"
                />
              </Col>
              <Col xs={4}>
                <Hotkey
                  combination={`${ctrl} + Shift + A`}
                  description="Toggle track changes"
                />
              </Col>
              <Col xs={4}>
                <Hotkey
                  combination={`${ctrl} + Shift + C`}
                  description="Add a comment"
                />
              </Col>
            </Row>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleHide}>{t('ok')}</Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

HotkeysModal.propTypes = {
  animation: PropTypes.bool,
  isMac: PropTypes.bool,
  show: PropTypes.bool.isRequired,
  handleHide: PropTypes.func.isRequired,
  trackChangesVisible: PropTypes.bool,
}

function Hotkey({ combination, description }) {
  return (
    <div className="hotkey" data-test-selector="hotkey">
      <span className="combination">{combination}</span>
      <span className="description">{description}</span>
    </div>
  )
}
Hotkey.propTypes = {
  combination: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
}
