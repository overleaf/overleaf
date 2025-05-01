import { expect } from 'chai'
import { render, screen, fireEvent } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import SystemMessages from '@/shared/components/system-messages'

describe('<SystemMessages />', function () {
  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
    localStorage.clear()
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
    localStorage.clear()
  })

  it('renders non-dismissable system message', async function () {
    const data = {
      _id: 'protected',
      content: 'Random content',
    }
    fetchMock.get(/\/system\/messages/, [data])
    render(<SystemMessages />)

    await fetchMock.callHistory.flush(true)

    await screen.findByText(data.content)
    expect(screen.queryByRole('button', { name: /close/i })).to.be.null
  })

  it('renders and closes dismissable system message', async function () {
    const data = {
      _id: 1,
      content: 'Random content',
    }
    fetchMock.get(/\/system\/messages/, [data])
    render(<SystemMessages />)

    await fetchMock.callHistory.flush(true)

    await screen.findByText(data.content)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)

    expect(screen.queryByText(data.content)).to.be.null

    const dismissed = localStorage.getItem(`systemMessage.hide.${data._id}`)
    expect(dismissed).to.equal('true')
  })

  it('renders and closes translation message', async function () {
    const data = {
      url: '/dev/null',
      lngName: 'German',
      imgUrl: 'https://flagcdn.com/w40/de.png',
    }
    const currentUrl = '/project'
    fetchMock.get(/\/system\/messages/, [])
    window.metaAttributesCache.set('ol-suggestedLanguage', data)
    window.metaAttributesCache.set('ol-currentUrl', currentUrl)
    render(<SystemMessages />)

    await fetchMock.callHistory.flush(true)

    const link = screen.getByRole('link', { name: /click here/i })
    expect(link.getAttribute('href')).to.equal(`${data.url}${currentUrl}`)

    const flag = screen.getByRole('img', { hidden: true })
    expect(flag.getAttribute('src')).to.equal(data.imgUrl)

    const closeBtn = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)

    expect(
      screen.queryByRole('link', {
        name: `Click here to use Overleaf in ${data.lngName}`,
      })
    ).to.be.null
    expect(screen.queryByRole('img')).to.be.null

    const dismissed = localStorage.getItem('hide-i18n-notification')
    expect(dismissed).to.equal('true')
  })
})
