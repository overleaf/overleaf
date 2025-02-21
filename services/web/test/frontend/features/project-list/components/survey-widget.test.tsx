import { expect } from 'chai'
import { fireEvent, render, screen } from '@testing-library/react'
import { SurveyWidgetDsNav } from '../../../../../frontend/js/features/project-list/components/survey-widget-ds-nav'
import { SplitTestProvider } from '@/shared/context/split-test-context'

describe('<SurveyWidgetDsNav />', function () {
  beforeEach(function () {
    this.name = 'my-survey'
    this.preText = 'To help shape the future of Overleaf'
    this.linkText = 'Click here!'
    this.url = 'https://example.com/my-survey'

    localStorage.clear()
  })

  describe('survey widget is visible', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-survey', {
        name: this.name,
        preText: this.preText,
        linkText: this.linkText,
        url: this.url,
      })

      render(
        <SplitTestProvider>
          <SurveyWidgetDsNav />
        </SplitTestProvider>
      )
    })

    it('shows text and link', function () {
      const dismissed = localStorage.getItem('dismissed-my-survey')
      expect(dismissed).to.equal(null)

      screen.getByText(this.preText)
      screen.getByText(this.linkText)

      const link = screen.getByRole('link', {
        name: 'Take survey',
      }) as HTMLAnchorElement
      expect(link.href).to.equal(this.url)
    })

    it('it is dismissed on click on the dismiss button', function () {
      const dismissButton = screen.getByRole('button', {
        name: 'Close',
      })
      fireEvent.click(dismissButton)

      const text = screen.queryByText(this.preText)
      expect(text).to.be.null

      const link = screen.queryByRole('link')
      expect(link).to.be.null

      const dismissed = localStorage.getItem('dismissed-my-survey')
      expect(dismissed).to.equal('true')
    })
  })

  describe('survey widget is not shown when already dismissed', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-survey', {
        name: this.name,
        preText: this.preText,
        linkText: this.linkText,
        url: this.url,
      })
      localStorage.setItem('dismissed-my-survey', 'true')

      render(
        <SplitTestProvider>
          <SurveyWidgetDsNav />
        </SplitTestProvider>
      )
    })

    it('nothing is displayed', function () {
      const text = screen.queryByText(this.preText)
      expect(text).to.be.null

      const link = screen.queryByRole('link')
      expect(link).to.be.null
    })
  })

  describe('survey widget is not shown when no survey is configured', function () {
    beforeEach(function () {
      render(
        <SplitTestProvider>
          <SurveyWidgetDsNav />
        </SplitTestProvider>
      )
    })

    it('nothing is displayed', function () {
      const text = screen.queryByText(this.preText)
      expect(text).to.be.null

      const link = screen.queryByRole('link')
      expect(link).to.be.null
    })
  })
})
