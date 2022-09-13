import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import ProjectsActionModal from '../../../../../../frontend/js/features/project-list/components/table/projects-action-modal'
import { projectsData } from '../../fixtures/projects-data'
import {
  resetProjectListContextFetch,
  renderWithProjectListContext,
} from '../../helpers/render-with-context'
import * as eventTracking from '../../../../../../frontend/js/infrastructure/event-tracking'

describe('<ProjectsActionModal />', function () {
  const actionHandler = sinon.stub().resolves({})
  let sendSpy: sinon.SinonSpy

  const modalText = {
    title: 'Action Title',
    top: <p>top text</p>,
    bottom: <b>bottom text</b>,
  }

  beforeEach(function () {
    sendSpy = sinon.spy(eventTracking, 'send')
  })

  afterEach(function () {
    sendSpy.restore()
    resetProjectListContextFetch()
  })

  it('should handle the action passed', async function () {
    renderWithProjectListContext(
      <ProjectsActionModal
        title={modalText.title}
        action="archive"
        actionHandler={actionHandler}
        bodyTop={modalText.top}
        bodyBottom={modalText.bottom}
        projects={[projectsData[0], projectsData[1]]}
        handleCloseModal={() => {}}
        showModal
      />
    )
    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement
    fireEvent.click(confirmBtn)
    expect(confirmBtn.disabled).to.be.true
    // verify action handled
    await waitFor(() => expect(actionHandler.callCount).to.equal(2))
  })

  it('should show an error message for all actions that fail', async function () {
    actionHandler
      .withArgs(projectsData[2])
      .rejects(new Error('Something went wrong. Please try again.'))
    actionHandler
      .withArgs(projectsData[3])
      .rejects(new Error('Something went wrong. Please try again.'))

    renderWithProjectListContext(
      <ProjectsActionModal
        title={modalText.title}
        action="archive"
        actionHandler={actionHandler}
        bodyTop={modalText.top}
        bodyBottom={modalText.bottom}
        projects={[
          projectsData[0],
          projectsData[1],
          projectsData[2],
          projectsData[3],
        ]}
        handleCloseModal={() => {}}
        showModal
      />
    )
    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).to.equal(2)
      expect(alerts[0].textContent).to.equal(
        `${projectsData[2].name}Something went wrong. Please try again.`
      )
      expect(alerts[1].textContent).to.equal(
        `${projectsData[3].name}Something went wrong. Please try again.`
      )
    })
  })

  it('should send an analytics even when opened', function () {
    renderWithProjectListContext(
      <ProjectsActionModal
        title={modalText.title}
        action="archive"
        actionHandler={actionHandler}
        bodyTop={modalText.top}
        bodyBottom={modalText.bottom}
        projects={[projectsData[0], projectsData[1]]}
        handleCloseModal={() => {}}
        showModal
      />
    )

    sinon.assert.calledWith(
      sendSpy,
      'project-list-page-interaction',
      'project action',
      'archive'
    )
  })
})
