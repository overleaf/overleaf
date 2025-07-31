import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import { screen, waitFor } from '@testing-library/react'
import LayoutDropdownButton from '../../../../../frontend/js/features/editor-navigation-toolbar/components/layout-dropdown-button'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import * as eventTracking from '@/infrastructure/event-tracking'
import type { LayoutContextOwnStates } from '@/shared/context/layout-context'

describe('<LayoutDropdownButton />', function () {
  let openStub: sinon.SinonStub
  let sendMBSpy: sinon.SinonSpy

  const defaultLayout: Partial<LayoutContextOwnStates> = {
    pdfLayout: 'flat',
    view: 'pdf',
    chatIsOpen: false,
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
    renderWithEditorContext(<LayoutDropdownButton />, {
      layoutContext: defaultLayout,
    })

    screen.getByRole('button', { name: 'Layout' }).click()

    await waitFor(() =>
      expect(
        screen
          .getByRole('menuitem', {
            name: 'Editor & PDF',
          })
          .getAttribute('aria-selected')
      ).to.equal('false')
    )

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

  it('should not select any option in history view', async function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, {
      layoutContext: { ...defaultLayout, view: 'history' },
    })

    screen.getByRole('button', { name: 'Layout' }).click()

    await waitFor(() =>
      expect(
        screen
          .getByRole('menuitem', {
            name: 'Editor & PDF',
          })
          .getAttribute('aria-selected')
      ).to.equal('false')
    )

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

  it('should treat file and editor views the same way', async function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, {
      layoutContext: {
        pdfLayout: 'flat',
        view: 'file',
        chatIsOpen: false,
      },
    })

    screen.getByRole('button', { name: 'Layout' }).click()

    await waitFor(() =>
      expect(
        screen
          .getByRole('menuitem', {
            name: 'Editor & PDF',
          })
          .getAttribute('aria-selected')
      ).to.equal('false')
    )

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

  describe('on detach', async function () {
    const originalBroadcastChannel = window.BroadcastChannel
    beforeEach(async function () {
      // @ts-expect-error
      window.BroadcastChannel = true // ensure that window.BroadcastChannel is truthy

      renderWithEditorContext(<LayoutDropdownButton />, {
        layoutContext: { ...defaultLayout, view: 'editor' },
      })

      screen.getByRole('button', { name: 'Layout' }).click()

      await waitFor(() =>
        screen
          .getByRole('menuitem', {
            name: 'PDF in separate tab',
          })
          .click()
      )
    })

    afterEach(function () {
      window.BroadcastChannel = originalBroadcastChannel
    })

    it('should show processing', async function () {
      await screen.findByText('Layout processing')
    })

    it('should record event', function () {
      sinon.assert.calledWith(sendMBSpy, 'project-layout-detach')
    })
  })

  describe('on layout change / reattach', async function () {
    beforeEach(async function () {
      window.metaAttributesCache.set('ol-detachRole', 'detacher')
      renderWithEditorContext(<LayoutDropdownButton />, {
        layoutContext: { ...defaultLayout, view: 'editor' },
      })

      screen.getByRole('button', { name: 'Layout' }).click()

      await waitFor(() =>
        screen
          .getByRole('menuitem', {
            name: 'Editor only (hide PDF)',
          })
          .click()
      )
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
