import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import { screen } from '@testing-library/react'
import LayoutDropdownButton from '../../../../../frontend/js/features/editor-navigation-toolbar/components/layout-dropdown-button'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import * as eventTracking from '@/infrastructure/event-tracking'

describe('<LayoutDropdownButton />', function () {
  let openStub
  let sendMBSpy
  const defaultUi = {
    pdfLayout: 'flat',
    view: 'pdf',
  }

  beforeEach(function () {
    openStub = sinon.stub(window, 'open')
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    openStub.restore()
    sendMBSpy.restore()
    fetchMock.removeRoutes().clearHistory()
  })

  it('should mark current layout option as selected', async function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, { ui: defaultUi })

    screen.getByRole('button', { name: 'Layout' }).click()

    expect(
      screen
        .getByRole('menuitem', {
          name: 'Editor & PDF',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'PDF only (hide editor)',
        })
        .getAttribute('aria-selected')
    ).to.equal('true')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'Editor only (hide PDF)',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'PDF in separate tab',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')
  })

  it('should not select any option in history view', function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, {
      ui: { ...defaultUi, view: 'history' },
    })

    screen.getByRole('button', { name: 'Layout' }).click()

    expect(
      screen
        .getByRole('menuitem', {
          name: 'Editor & PDF',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'PDF only (hide editor)',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'Editor only (hide PDF)',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'PDF in separate tab',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')
  })

  it('should treat file and editor views the same way', function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, {
      ui: {
        pdfLayout: 'flat',
        view: 'file',
      },
    })

    screen.getByRole('button', { name: 'Layout' }).click()

    expect(
      screen
        .getByRole('menuitem', {
          name: 'Editor & PDF',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'PDF only (hide editor)',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'Editor only (hide PDF)',
        })
        .getAttribute('aria-selected')
    ).to.equal('true')

    expect(
      screen
        .getByRole('menuitem', {
          name: 'PDF in separate tab',
        })
        .getAttribute('aria-selected')
    ).to.equal('false')
  })

  describe('on detach', function () {
    let originalBroadcastChannel
    beforeEach(function () {
      window.BroadcastChannel = originalBroadcastChannel || true // ensure that window.BroadcastChannel is truthy

      renderWithEditorContext(<LayoutDropdownButton />, {
        ui: { ...defaultUi, view: 'editor' },
      })

      screen.getByRole('button', { name: 'Layout' }).click()

      screen
        .getByRole('menuitem', {
          name: 'PDF in separate tab',
        })
        .click()
    })

    afterEach(function () {
      window.BroadcastChannel = originalBroadcastChannel
    })

    it('should show processing', function () {
      screen.getByText('Layout processing')
    })

    it('should record event', function () {
      sinon.assert.calledWith(sendMBSpy, 'project-layout-detach')
    })
  })

  describe('on layout change / reattach', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detacher')
      renderWithEditorContext(<LayoutDropdownButton />, {
        ui: { ...defaultUi, view: 'editor' },
      })

      screen.getByRole('button', { name: 'Layout' }).click()

      screen
        .getByRole('menuitem', {
          name: 'Editor only (hide PDF)',
        })
        .click()
    })

    it('should not show processing', function () {
      const processingText = screen.queryByText('Layout processing')
      expect(processingText).to.not.exist
    })

    it('should record events', function () {
      sinon.assert.calledWith(sendMBSpy, 'project-layout-reattach')
      sinon.assert.calledWith(sendMBSpy, 'project-layout-change', {
        layout: 'flat',
        view: 'editor',
        page: '/detacher',
      })
    })

    it('should select new menu item', function () {
      screen.getByRole('menuitem', {
        name: 'Editor only (hide PDF)',
      })
    })
  })
})
