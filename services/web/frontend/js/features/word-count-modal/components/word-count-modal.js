import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import PropTypes from 'prop-types'
import WordCountModalContent from './word-count-modal-content'

function WordCountModal({ handleHide, show, projectId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState()
  const [abortController, setAbortController] = useState(new AbortController())

  useEffect(() => {
    if (!show) {
      return
    }

    setData(undefined)
    setError(false)
    setLoading(true)

    const _abortController = new AbortController()
    setAbortController(_abortController)

    fetch(`/project/${projectId}/wordcount`, {
      signal: _abortController.signal
    })
      .then(async response => {
        if (response.ok) {
          const { texcount } = await response.json()
          setData(texcount)
        } else {
          setError(true)
        }
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })

    return () => {
      _abortController.abort()
    }
  }, [show, projectId])

  const abortAndHide = useCallback(() => {
    abortController.abort()
    handleHide()
  }, [abortController, handleHide])

  return (
    <Modal show={show} onHide={abortAndHide}>
      <WordCountModalContent
        data={data}
        error={error}
        handleHide={abortAndHide}
        loading={loading}
      />
    </Modal>
  )
}

WordCountModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  show: PropTypes.bool.isRequired
}

export default WordCountModal
