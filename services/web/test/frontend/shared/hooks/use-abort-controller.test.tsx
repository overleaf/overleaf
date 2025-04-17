import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import useAbortController from '../../../../frontend/js/shared/hooks/use-abort-controller'
import { getJSON } from '../../../../frontend/js/infrastructure/fetch-json'

describe('useAbortController', function () {
  let status: {
    loading: boolean
    success: boolean | null
    error: any | null
  }

  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()

    status = {
      loading: false,
      success: null,
      error: null,
    }
  })

  after(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  function AbortableRequest({ url }: { url: string }) {
    const { signal } = useAbortController()

    React.useEffect(() => {
      status.loading = true

      getJSON(url, { signal })
        .then(() => {
          status.success = true
        })
        .catch(error => {
          status.error = error
        })
        .finally(() => {
          status.loading = false
        })
    }, [signal, url])

    return null
  }

  it('calls then when the request succeeds', async function () {
    fetchMock.get('/test', { status: 204 }, { delay: 100 })

    render(<AbortableRequest url="/test" />)

    expect(status.loading).to.be.true
    await waitFor(() => expect(status.loading).to.be.false)

    expect(status.success).to.be.true
    expect(status.error).to.be.null
  })

  it('calls catch when the request fails', async function () {
    fetchMock.get('/test', { status: 500 }, { delay: 100 })

    render(<AbortableRequest url="/test" />)

    expect(status.loading).to.be.true
    await waitFor(() => expect(status.loading).to.be.false)

    expect(status.success).to.be.null
    expect(status.error).not.to.be.null
  })

  it('cancels a request when unmounted', async function () {
    fetchMock.get('/test', { status: 204 }, { delay: 100 })

    const { unmount } = render(<AbortableRequest url="/test" />)

    expect(status.loading).to.be.true

    unmount()

    await fetchMock.callHistory.flush(true)
    expect(fetchMock.callHistory.done()).to.be.true

    // wait for Promises to be resolved
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(status.success).to.be.null
    expect(status.error).to.be.null
    expect(status.loading).to.be.true
  })
})
