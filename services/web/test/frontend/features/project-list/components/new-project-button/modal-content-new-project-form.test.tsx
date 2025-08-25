import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import sinon from 'sinon'
import ModalContentNewProjectForm from '../../../../../../frontend/js/features/project-list/components/new-project-button/modal-content-new-project-form'
import { location } from '@/shared/components/location'

describe('<ModalContentNewProjectForm />', function () {
  beforeEach(function () {
    this.locationWrapperSandbox = sinon.createSandbox()
    this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
  })

  afterEach(function () {
    this.locationWrapperSandbox.restore()
    fetchMock.removeRoutes().clearHistory()
  })

  it('submits form', async function () {
    const projectId = 'ab123'

    const newProjectMock = fetchMock.post('/project/new', {
      status: 200,
      body: {
        project_id: projectId,
      },
    })

    render(<ModalContentNewProjectForm onCancel={() => {}} />)

    const createButton = screen.getByRole('button', {
      name: 'Create',
    })

    expect(createButton.getAttribute('disabled')).to.exist

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'Test Name' },
    })

    expect(createButton.getAttribute('disabled')).to.be.null

    fireEvent.click(createButton)

    expect(newProjectMock.callHistory.called()).to.be.true

    const assignStub = this.locationWrapperStub.assign
    await waitFor(() => {
      sinon.assert.calledOnce(assignStub)
    })
    sinon.assert.calledWith(assignStub, `/project/${projectId}`)
  })

  it('shows error when project name contains "/"', async function () {
    const errorMessage = 'Project name cannot contain / characters'

    const newProjectMock = fetchMock.post('/project/new', {
      status: 400,
      body: errorMessage,
    })

    render(<ModalContentNewProjectForm onCancel={() => {}} />)

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: '/' },
    })

    const createButton = screen.getByRole('button', {
      name: 'Create',
    })
    fireEvent.click(createButton)

    expect(newProjectMock.callHistory.called()).to.be.true

    await waitFor(() => {
      screen.getByText(errorMessage)
    })
  })

  it('shows error when project name contains "\\" character', async function () {
    const errorMessage = 'Project name cannot contain \\ characters'

    const newProjectMock = fetchMock.post('/project/new', {
      status: 400,
      body: errorMessage,
    })

    render(<ModalContentNewProjectForm onCancel={() => {}} />)

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: '\\' },
    })

    const createButton = screen.getByRole('button', {
      name: 'Create',
    })
    fireEvent.click(createButton)

    expect(newProjectMock.callHistory.called()).to.be.true

    await waitFor(() => {
      screen.getByText(errorMessage)
    })
  })

  it('shows error when project name is too long ', async function () {
    const errorMessage = 'Project name is too long'

    const newProjectMock = fetchMock.post('/project/new', {
      status: 400,
      body: errorMessage,
    })

    render(<ModalContentNewProjectForm onCancel={() => {}} />)

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: {
        value: `
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Arcu risus quis varius quam quisque id diam vel quam. Sit amet porttitor eget dolor morbi non arcu risus quis. In aliquam sem fringilla ut. Gravida cum sociis natoque penatibus. Semper risus in hendrerit gravida rutrum quisque non. Ut aliquam purus sit amet luctus venenatis. Neque ornare aenean euismod elementum nisi. Adipiscing bibendum est ultricies integer quis auctor elit. Nulla posuere sollicitudin aliquam ultrices sagittis. Nulla facilisi nullam vehicula ipsum a arcu cursus. Tristique senectus et netus et malesuada fames ac. Pulvinar pellentesque habitant morbi tristique senectus et netus et. Nisi scelerisque eu ultrices vitae auctor eu. Hendrerit gravida rutrum quisque non tellus orci. Volutpat blandit aliquam etiam erat velit scelerisque in dictum non. Donec enim diam vulputate ut pharetra sit amet aliquam id. Ullamcorper eget nulla facilisi etiam.
      Enim praesent elementum facilisis leo vel fringilla est. Semper eget duis at tellus. Lacus luctus accumsan tortor posuere ac ut consequat semper viverra. Et malesuada fames ac turpis egestas maecenas pharetra convallis posuere. Ultrices in iaculis nunc sed augue lacus. Tellus orci ac auctor augue mauris augue. Velit scelerisque in dictum non consectetur a erat. Sed turpis tincidunt id aliquet risus. Felis eget velit aliquet sagittis id. Convallis tellus id interdum velit laoreet id.
      Habitasse platea dictumst quisque sagittis. Massa sed elementum tempus egestas sed. Cursus eget nunc scelerisque viverra mauris in aliquam sem. Sociis natoque penatibus et magnis dis parturient montes nascetur. Mi in nulla posuere sollicitudin aliquam ultrices sagittis orci a. Fames ac turpis egestas sed tempus urna et pharetra. Pellentesque massa placerat duis ultricies lacus sed turpis tincidunt id. Erat pellentesque adipiscing commodo elit at imperdiet dui. Lectus magna fringilla urna porttitor rhoncus dolor purus non enim. Sagittis nisl rhoncus mattis rhoncus urna neque viverra. Nibh sed pulvinar proin gravida. Sed adipiscing diam donec adipiscing tristique risus nec feugiat in. Elit duis tristique sollicitudin nibh sit amet commodo. Vivamus arcu felis bibendum ut tristique et egestas. Tellus in hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Vitae purus faucibus ornare suspendisse sed. Adipiscing elit duis tristique sollicitudin nibh sit amet commodo nulla.
      Vitae congue mauris rhoncus aenean vel elit scelerisque mauris pellentesque. Erat imperdiet sed euismod nisi porta lorem mollis aliquam. Accumsan tortor posuere ac ut consequat semper viverra nam libero. Malesuada fames ac turpis egestas sed tempus urna et. Tellus mauris a diam maecenas sed enim ut sem viverra. Mauris in aliquam sem fringilla ut. Feugiat pretium nibh ipsum consequat. Nisl tincidunt eget nullam non nisi. Tortor consequat id porta nibh. Mattis rhoncus urna neque viverra justo nec ultrices dui sapien. Ac tincidunt vitae semper quis lectus nulla at. Risus quis varius quam quisque id diam. Nisl nunc mi ipsum faucibus vitae aliquet.
      Fringilla phasellus faucibus scelerisque eleifend. Eget egestas purus viverra accumsan in nisl nisi scelerisque eu. Mauris commodo quis imperdiet massa tincidunt nunc. Nunc mi ipsum faucibus vitae aliquet nec ullamcorper sit. Elit duis tristique sollicitudin nibh sit amet commodo nulla facilisi. Phasellus egestas tellus rutrum tellus pellentesque eu tincidunt tortor aliquam. Mi sit amet mauris commodo quis imperdiet massa. Urna nec tincidunt praesent semper feugiat nibh sed pulvinar proin. Tempor nec feugiat nisl pretium fusce id velit ut. Morbi tristique senectus et netus et.
      Accumsan in nisl nisi scelerisque eu ultrices vitae. Metus vulputate eu scelerisque felis imperdiet proin fermentum leo. Viverra tellus in hac habitasse platea dictumst vestibulum. Non arcu risus quis varius quam quisque id diam. Turpis cursus in hac habitasse platea dictumst. Erat imperdiet sed euismod nisi porta. Eu augue ut lectus arcu bibendum at varius vel pharetra. Aliquam ultrices sagittis orci a scelerisque. Amet consectetur adipiscing elit pellentesque habitant morbi tristique. Lobortis scelerisque fermentum dui faucibus in ornare quam. Commodo sed egestas egestas fringilla phasellus faucibus. Mauris augue neque gravida in fermentum. Ut eu sem integer vitae justo eget magna fermentum. Phasellus egestas tellus rutrum tellus pellentesque eu. Lorem ipsum dolor sit amet consectetur adipiscing. Nulla facilisi morbi tempus iaculis urna id. In egestas erat imperdiet sed euismod nisi porta lorem. Ipsum faucibus vitae aliquet nec ullamcorper sit amet risus.
      Feugiat in fermentum posuere urna nec. Elementum eu facilisis sed odio morbi quis commodo. Vel fringilla est ullamcorper eget nulla facilisi. Nunc sed blandit libero volutpat sed cras ornare arcu dui. Tortor id aliquet lectus proin nibh nisl condimentum id venenatis. Sapien pellentesque habitant morbi tristique senectus et. Quam elementum pulvinar etiam non quam lacus suspendisse faucibus. Sem nulla pharetra diam sit amet nisl suscipit adipiscing bibendum. Porttitor leo a diam sollicitudin tempor id. In iaculis nunc sed augue.
      Velit euismod in pellentesque massa placerat duis ultricies lacus sed. Dictum fusce ut placerat orci nulla pellentesque dignissim enim. Dui id ornare arcu odio. Dignissim cras tincidunt lobortis feugiat vivamus at augue. Non tellus orci ac auctor. Egestas fringilla phasellus faucibus scelerisque eleifend donec. Nisi vitae suscipit tellus mauris a diam maecenas. Orci dapibus ultrices in iaculis nunc sed. Facilisi morbi tempus iaculis urna id volutpat lacus laoreet non. Aliquam etiam erat velit scelerisque in dictum. Sed enim ut sem viverra. Eleifend donec pretium vulputate sapien nec sagittis. Quisque egestas diam in arcu cursus euismod quis. Faucibus a pellentesque sit amet porttitor eget dolor. Elementum facilisis leo vel fringilla. Pellentesque habitant morbi tristique senectus et netus. Viverra tellus in hac habitasse platea dictumst vestibulum. Tincidunt nunc pulvinar sapien et ligula ullamcorper malesuada proin. Sit amet porttitor eget dolor morbi non. Neque egestas congue quisque egestas.
      Convallis posuere morbi leo urna molestie at. Posuere sollicitudin aliquam ultrices sagittis orci. Lacus vestibulum sed arcu non odio. Sit amet dictum sit amet. Nunc scelerisque viverra mauris in aliquam sem fringilla ut morbi. Vestibulum morbi blandit cursus risus at ultrices mi. Purus gravida quis blandit turpis cursus. Diam maecenas sed enim ut. Senectus et netus et malesuada fames ac turpis. Massa tempor nec feugiat nisl pretium fusce id velit. Mollis nunc sed id semper. Elit sed vulputate mi sit. Vitae et leo duis ut diam. Pellentesque sit amet porttitor eget dolor morbi non arcu risus.
      Mi quis hendrerit dolor magna eget est lorem. Quam vulputate dignissim suspendisse in est ante in nibh. Nisi porta lorem mollis aliquam. Duis tristique sollicitudin nibh sit amet commodo nulla facilisi nullam. Euismod nisi porta lorem mollis aliquam ut porttitor leo a. Tempus imperdiet nulla malesuada pellentesque elit eget. Amet nisl purus in mollis nunc sed id. Id velit ut tortor pretium viverra suspendisse. Integer quis auctor elit sed. Tortor at risus viverra adipiscing. Ac auctor augue mauris augue neque gravida in. Lacus laoreet non curabitur gravida arcu ac tortor dignissim convallis. A diam sollicitudin tempor id eu nisl nunc mi. Tellus id interdum velit laoreet id donec. Lacus vestibulum sed arcu non odio euismod lacinia. Tellus at urna condimentum mattis.
      `,
      },
    })

    const createButton = screen.getByRole('button', {
      name: 'Create',
    })
    fireEvent.click(createButton)

    expect(newProjectMock.callHistory.called()).to.be.true

    await waitFor(() => {
      screen.getByText(errorMessage)
    })
  })
})
