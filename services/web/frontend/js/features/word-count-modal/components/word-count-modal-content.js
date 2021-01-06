import React from 'react'
import { Row, Col, Modal, Grid, Alert, Button } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function WordCountModalContent({ data, error, handleHide, loading }) {
  const { t } = useTranslation()

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{t('word_count')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading && !error && (
          <div className="loading">
            <Loading /> &nbsp; {t('loading')}…
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
    </>
  )
}

WordCountModalContent.propTypes = {
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

function Loading() {
  return <Icon type="refresh" spin modifier="fw" accessibilityLabel="Loading" />
}

export default WordCountModalContent
