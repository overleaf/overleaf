import React from 'react'
import { Row, Col, Modal, Grid, Alert, Button } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import AccessibleModal from '../../../shared/components/accessible-modal'

export default function WordCountModalContent({
  animation = true,
  show,
  data,
  error,
  handleHide,
  loading
}) {
  const { t } = useTranslation()

  return (
    <AccessibleModal
      animation={animation}
      show={show}
      onHide={handleHide}
      id="clone-project-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>{t('word_count')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading && !error && (
          <div className="loading">
            <Icon type="refresh" spin modifier="fw" /> &nbsp; {t('loading')}…
          </div>
        )}

        {error && (
          <Alert bsStyle="danger">{t('generic_something_went_wrong')}</Alert>
        )}

        {data && (
          <Grid fluid>
            {data.messages && (
              <Row>
                <Col xs={12}>
                  <Alert bsStyle="danger">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{data.messages}</p>
                  </Alert>
                </Col>
              </Row>
            )}

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('total_words')}:</div>
              </Col>
              <Col xs={6}>{data.textWords}</Col>
            </Row>

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('headers')}:</div>
              </Col>
              <Col xs={6}>{data.headers}</Col>
            </Row>

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('math_inline')}:</div>
              </Col>
              <Col xs={6}>{data.mathInline}</Col>
            </Row>

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('math_display')}:</div>
              </Col>
              <Col xs={6}>{data.mathDisplay}</Col>
            </Row>
          </Grid>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleHide}>{t('done')}</Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

WordCountModalContent.propTypes = {
  animation: PropTypes.bool,
  show: PropTypes.bool.isRequired,
  handleHide: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.bool,
  data: PropTypes.shape({
    messages: PropTypes.string,
    headers: PropTypes.number,
    mathDisplay: PropTypes.number,
    mathInline: PropTypes.number,
    textWords: PropTypes.number
  })
}
