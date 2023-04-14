import { Button, Modal, Row, Col } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'
import AccessibleModal from '../../../shared/components/accessible-modal'
import HotkeysModalBottomText from './hotkeys-modal-bottom-text'

export default function HotkeysModal({
  animation = true,
  handleHide,
  show,
  isMac = false,
  trackChangesVisible = false,
  newSourceEditor = false,
}) {
  const { t } = useTranslation()

  const goToLineSuffix = newSourceEditor ? 'Shift + L' : 'L'
  const ctrl = isMac ? 'Cmd' : 'Ctrl'

  const modalTitle = newSourceEditor
    ? `${t('hotkeys')} (Source editor)`
    : `${t('hotkeys')} (Legacy source editor)`

  return (
    <AccessibleModal
      bsSize="large"
      onHide={handleHide}
      show={show}
      animation={animation}
    >
      <Modal.Header closeButton>
        <Modal.Title>{modalTitle}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="hotkeys-modal">
        <h3>{t('common')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + F`}
              description={t('hotkey_find_and_replace')}
            />
            <Hotkey
              combination={`${ctrl} + Enter`}
              description={t('hotkey_compile')}
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + Z`}
              description={t('hotkey_undo')}
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + Y`}
              description={t('hotkey_redo')}
            />
          </Col>
        </Row>

        <h3>{t('navigation')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + Home`}
              description={t('hotkey_beginning_of_document')}
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + End`}
              description={t('hotkey_end_of_document')}
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + ${goToLineSuffix}`}
              description={t('hotkey_go_to_line')}
            />
          </Col>
        </Row>

        <h3>{t('editing')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + /`}
              description={t('hotkey_toggle_comment')}
            />
            <Hotkey
              combination={`${ctrl} + D`}
              description={t('hotkey_delete_current_line')}
            />
            <Hotkey
              combination={`${ctrl} + A`}
              description={t('hotkey_select_all')}
            />
          </Col>

          <Col xs={4}>
            <Hotkey
              combination="Ctrl + U"
              description={t('hotkey_to_uppercase')}
            />
            <Hotkey
              combination="Ctrl + Shift + U"
              description={t('hotkey_to_lowercase')}
            />
            <Hotkey
              combination="Tab"
              description={t('hotkey_indent_selection')}
            />
          </Col>

          <Col xs={4}>
            <Hotkey
              combination={`${ctrl} + B`}
              description={t('hotkey_bold_text')}
            />
            <Hotkey
              combination={`${ctrl} + I`}
              description={t('hotkey_italic_text')}
            />
          </Col>
        </Row>

        <h3>{t('autocomplete')}</h3>

        <Row>
          <Col xs={4}>
            <Hotkey
              combination="Ctrl + Space"
              description={t('hotkey_autocomplete_menu')}
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination="Up / Down"
              description={t('hotkey_select_candidate')}
            />
          </Col>
          <Col xs={4}>
            <Hotkey
              combination="Enter / Tab"
              description={t('hotkey_insert_candidate')}
            />
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
              combination={`Ctrl + Space `}
              description={t('hotkey_search_references')}
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
                  description={t('hotkey_toggle_review_panel')}
                />
              </Col>
              <Col xs={4}>
                <Hotkey
                  combination={`${ctrl} + Shift + A`}
                  description={t('hotkey_toggle_track_changes')}
                />
              </Col>
              <Col xs={4}>
                <Hotkey
                  combination={`${ctrl} + Shift + C`}
                  description={t('hotkey_add_a_comment')}
                />
              </Col>
            </Row>
          </>
        )}
        <HotkeysModalBottomText />
      </Modal.Body>

      <Modal.Footer>
        <Button bsStyle={null} className="btn-secondary" onClick={handleHide}>
          {t('ok')}
        </Button>
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
  newSourceEditor: PropTypes.bool,
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
