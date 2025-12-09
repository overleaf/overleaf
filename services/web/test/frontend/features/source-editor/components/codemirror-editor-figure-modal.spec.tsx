import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import {
  EditorProviders,
  makeEditorPropertiesProvider,
  makeProjectProvider,
  USER_ID,
} from '../../../helpers/editor-providers'
import { mockScope, rootFolderId } from '../helpers/mock-scope'
import { FC } from 'react'
import { FileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { TestContainer } from '../helpers/test-container'
import getMeta from '@/utils/meta'
import { mockProject } from '../helpers/mock-project'
import { base64image } from '../fixtures/image'

const svgContent =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'

const findInsertFigureToolbarButton = () => {
  return cy.findByRole('toolbar').within(() => {
    return cy
      .findByRole('button', { name: /Insert figure/i })
      .as('insertFigureToolbarButton')
  })
}

const findInsertFigureDialogButton = () => {
  return cy.findByRole('dialog').within(() => {
    // There are two buttons with this name, one in the footer and one in the toolbar
    return cy
      .findByRole('button', { name: /Insert figure/i })
      .as('insertFigureDialogButton')
  })
}

const clickFigureToolbarButton = () => {
  findInsertFigureToolbarButton()
  cy.get('@insertFigureToolbarButton').click()
  cy.get('@insertFigureToolbarButton').trigger('mouseout')
}

const chooseFileFromComputer = () => {
  cy.get('@file-input').selectFile(
    {
      fileName: 'frog.jpg',
      contents: Cypress.Buffer.from('image-data'),
      mimeType: 'image/jpg',
    },
    {
      force: true,
    }
  )
}

const matchUrl = (urlToMatch: RegExp | string) =>
  Cypress.sinon.match(req => {
    if (!req || typeof req.url !== 'string') {
      return false
    }
    if (typeof urlToMatch === 'string') {
      return req.url.endsWith(urlToMatch)
    }
    return Boolean(req.url.match(urlToMatch))
  })

describe('<FigureModal />', function () {
  // TODO: rewrite these tests to be in source mode when toolbar is added there
  // TODO: Write tests for width toggle, when we can match on source code
  function mount() {
    const content = ''
    const scope = mockScope(content)
    const project = mockProject({
      projectOwner: {
        _id: USER_ID,
      },
    })

    const FileTreePathProvider: FC<React.PropsWithChildren> = ({
      children,
    }) => (
      <FileTreePathContext.Provider
        value={{
          dirname: cy.stub(),
          findEntityByPath: cy.stub(),
          pathInFolder: cy.stub(),
          previewByPath: cy
            .stub()
            .as('previewByPath')
            .callsFake(path => {
              if (path === 'diagram.svg' || path === 'diagram') {
                return {
                  url: '/project/test-project/blob/abc123',
                  extension: 'svg',
                }
              }
              // Default to PNG for any other path (for non-SVG tests)
              return { url: base64image, extension: 'png' }
            }),
        }}
      >
        {children}
      </FileTreePathContext.Provider>
    )

    cy.mount(
      <TestContainer>
        <EditorProviders
          scope={scope}
          providers={{
            FileTreePathProvider,
            ProjectProvider: makeProjectProvider(project),
            EditorPropertiesProvider: makeEditorPropertiesProvider({
              showVisual: true,
              showSymbolPalette: false,
            }),
          }}
        >
          <CodemirrorEditor />
        </EditorProviders>
      </TestContainer>
    )
  }

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptMathJax()
    cy.interceptEvents()
    cy.interceptMetadata()

    mount()
  })

  describe('Upload from computer source', function () {
    beforeEach(function () {
      cy.interceptFileUpload()
      clickFigureToolbarButton()
      cy.findByRole('menu').within(() => {
        cy.findByText('Upload from computer').click()
      })
      cy.findByLabelText('Uppy Dashboard')
        .get('.uppy-Dashboard-input:first')
        .as('file-input')
      findInsertFigureDialogButton()
    })

    it('Shows file name and size when selecting file', function () {
      chooseFileFromComputer()
      cy.findByLabelText('File name').should('have.text', 'frog.jpg')
      cy.findByLabelText('File size').should('have.text', '10 B')
    })

    it('Uploads file when clicking insert', function () {
      chooseFileFromComputer()
      cy.get('@uploadRequest').should('not.have.been.called')
      cy.findByText('Insert figure').click()
      cy.get('@uploadRequest').should(
        'have.been.calledWith',
        matchUrl(`/project/test-project/upload?folder_id=${rootFolderId}`)
      )

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit    \\caption{Enter Caption}    🏷fig:placeholder\\end{figure}'
      )
    })

    it('Enables insert button when choosing file', function () {
      cy.get('@insertFigureDialogButton').should('be.disabled')
      chooseFileFromComputer()
      cy.get('@insertFigureDialogButton').should('be.enabled')
    })
  })

  describe('Upload from project files source', function () {
    beforeEach(function () {
      clickFigureToolbarButton()
      cy.findByRole('menu').within(() => {
        cy.findByText('From project files').click()
      })
      findInsertFigureDialogButton()
    })

    it('Lists files from project', function () {
      cy.findByRole('combobox', { name: 'Image file' }).click()
      cy.findByRole('listbox')
        .children()
        .should('have.length', 2)
        .should('contain.text', 'frog.jpg')
        .should('contain.text', 'unicorn.png')
        .should('contain.text', 'figures/')
    })

    it('Enables insert button when choosing file', function () {
      cy.get('@insertFigureDialogButton').should('be.disabled')
      cy.findByRole('combobox', { name: 'Image file' }).click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.get('@insertFigureDialogButton').should('be.enabled')
    })

    it('Inserts file when pressing insert button', function () {
      cy.findByRole('combobox', { name: 'Image file' }).click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.get('@insertFigureDialogButton').click()

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit    \\caption{Enter Caption}    🏷fig:placeholder\\end{figure}'
      )
    })
  })

  describe('From another project source', function () {
    beforeEach(function () {
      cy.interceptProjectListing()
      cy.interceptCompile()
      cy.interceptLinkedFile()
      clickFigureToolbarButton()
      cy.findByRole('menu').within(() => {
        cy.findByRole('button', { name: 'From another project' }).click()
      })
      cy.findByRole('combobox', { name: 'Project' }).as('project-dropdown')
      cy.findByRole('combobox', { name: 'Image file' }).as('file-dropdown')
      findInsertFigureDialogButton()
    })

    it('List projects and files in projects', function () {
      cy.get('@insertFigureDialogButton').should('be.disabled')
      cy.get('@file-dropdown').should('be.disabled')
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findAllByRole('option').should('have.length', 2)
        cy.findByRole('option', { name: 'My first project' }).click()
      })
      cy.get('@file-dropdown').should('be.enabled')
      cy.get('@file-dropdown').click()
      cy.findByRole('listbox').as('file-select')
      cy.get('@file-select').children().should('have.length', 2)
      cy.get('@file-select').should('contain.text', 'frog.jpg')
      cy.get('@file-select').should('contain.text', 'figures/unicorn.png')
      cy.get('@file-select').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.get('@insertFigureDialogButton').should('be.enabled')
    })

    it('Enables insert button when choosing file', function () {
      cy.get('@insertFigureDialogButton').should('be.disabled')
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: 'My first project' }).click()
      })
      cy.get('@file-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: 'frog.jpg' }).click()
      })
      cy.get('@insertFigureDialogButton').should('be.enabled')
    })

    it('Closes project dropdown on pressing Esc key but leaves modal open', function () {
      cy.get('@insertFigureDialogButton').should('be.disabled')
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').should('exist')
      cy.get('@project-dropdown').type('{esc}', { force: true })
      cy.findByRole('listbox').should('not.exist')
      cy.findByRole('dialog').should('exist')

      // Check that a subsequent press of the Esc key closes the modal
      cy.get('@project-dropdown').type('{esc}', { force: true })
      cy.findByRole('dialog').should('not.exist')
    })

    it('Creates linked file when pressing insert', function () {
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: 'My first project' }).click()
      })
      cy.get('@file-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.findByText('Insert figure').click()
      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'project_file',
          data: {
            source_entity_path: '/frog.jpg',
            source_project_id: 'fake-project-1',
          },
        },
      })

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit    \\caption{Enter Caption}    🏷fig:placeholder\\end{figure}'
      )
    })

    it('Creates linked output file when pressing insert', function () {
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: 'My first project' }).click()
      })
      cy.findByRole('button', { name: 'select from output files' }).click()
      cy.findByRole('combobox', { name: 'Output file' }).click()
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: 'output.pdf' }).click()
      })
      cy.findByText('Insert figure').click()
      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'project_output_file',
          data: {
            source_output_file_path: 'output.pdf',
            source_project_id: 'fake-project-1',
          },
        },
      })

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit    \\caption{Enter Caption}    🏷fig:placeholder\\end{figure}'
      )
    })
  })

  describe('Feature flags', function () {
    describe('with hasLinkUrlFeature=false', function () {
      beforeEach(function () {
        Object.assign(getMeta('ol-ExposedSettings'), {
          hasLinkedProjectFileFeature: true,
          hasLinkedProjectOutputFileFeature: true,
          hasLinkUrlFeature: false,
        })
        mount()
        clickFigureToolbarButton()
      })
      it('should not have import from url option', function () {
        cy.findByRole('menu').within(() => {
          cy.findByText('From URL').should('not.exist')
        })
      })
    })
    describe('with hasLinkedProjectFileFeature=false and hasLinkedProjectOutputFileFeature=false', function () {
      beforeEach(function () {
        Object.assign(getMeta('ol-ExposedSettings'), {
          hasLinkedProjectFileFeature: false,
          hasLinkedProjectOutputFileFeature: false,
          hasLinkUrlFeature: true,
        })
        mount()
        clickFigureToolbarButton()
      })
      it('should not have import from project file option', function () {
        cy.findByRole('menu').within(() => {
          cy.findByText('From another project').should('not.exist')
        })
      })
    })

    function setupFromAnotherProject() {
      mount()
      cy.interceptProjectListing()
      clickFigureToolbarButton()
      cy.findByRole('menu').within(() => {
        cy.findByText('From another project').click()
      })
      cy.findByRole('combobox', { name: 'Project' }).click()
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: 'My first project' }).click()
      })
    }
    function expectNoOutputSwitch() {
      it('should hide output switch', function () {
        cy.findByText('select from output files').should('not.exist')
        cy.findByText('select from source files').should('not.exist')
      })
    }

    describe('with hasLinkedProjectFileFeature=false', function () {
      beforeEach(function () {
        Object.assign(getMeta('ol-ExposedSettings'), {
          hasLinkedProjectFileFeature: false,
          hasLinkedProjectOutputFileFeature: true,
          hasLinkUrlFeature: true,
        })
        cy.interceptCompile()
        setupFromAnotherProject()
      })
      expectNoOutputSwitch()
      it('should show output file selector', function () {
        cy.findByRole('combobox', { name: 'Output file' }).click()
        cy.findByRole('listbox').within(() => {
          cy.findByRole('option', { name: 'output.pdf' }).click()
        })
      })
    })

    describe('with hasLinkedProjectOutputFileFeature=false', function () {
      beforeEach(function () {
        Object.assign(getMeta('ol-ExposedSettings'), {
          hasLinkedProjectFileFeature: true,
          hasLinkedProjectOutputFileFeature: false,
          hasLinkUrlFeature: true,
        })
        setupFromAnotherProject()
      })
      expectNoOutputSwitch()

      it('should show source file selector', function () {
        cy.findByRole('combobox', { name: 'Image file' }).click()
        cy.findByRole('listbox').within(() => {
          cy.findByRole('option', { name: 'frog.jpg' }).click()
        })
      })
    })
  })

  describe('From URL source', function () {
    beforeEach(function () {
      cy.interceptLinkedFile()
      clickFigureToolbarButton()
      cy.findByRole('menu').within(() => {
        cy.findByText('From URL').click()
      })
      cy.findByLabelText('File name in this project').as(
        'relocated-file-name-input'
      )
      cy.findByLabelText('Image URL').as('image-url-input')
      cy.findByRole('checkbox', { name: 'Include label' }).as(
        'include-label-checkbox'
      )
      cy.findByRole('checkbox', { name: 'Include caption' }).as(
        'include-caption-checkbox'
      )
      findInsertFigureDialogButton()
    })

    it('Auto fills name based on url', function () {
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.get('@relocated-file-name-input').should('have.value', 'frog.jpg')
      cy.get('@relocated-file-name-input').type('pig')
      cy.get('@relocated-file-name-input').should('have.value', 'pig.jpg')
    })

    it('Enables insert button when name and url is available', function () {
      cy.get('@insertFigureDialogButton').should('be.disabled')
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.get('@insertFigureDialogButton').should('be.enabled')
    })

    it('Adds linked file when pressing insert', function () {
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.get('@insertFigureDialogButton').click()

      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'url',
          data: {
            url: 'https://my-fake-website.com/frog.jpg',
          },
        },
      })

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit    \\caption{Enter Caption}    🏷fig:placeholder\\end{figure}'
      )
    })

    it('Selects the caption when the figure is inserted with a caption', function () {
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.get('@insertFigureDialogButton').click()

      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'url',
          data: {
            url: 'https://my-fake-website.com/frog.jpg',
          },
        },
      })

      cy.get('.cm-selectionLayer .cm-selectionBackground').should(
        'have.length',
        1
      )

      // If caption is selected then typing will replace the whole caption
      cy.focused().type('My caption')

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit    \\caption{My caption}    🏷fig:placeholder\\end{figure}'
      )
    })

    it('Selects the label when the figure is inserted without a caption', function () {
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.get('@include-caption-checkbox').uncheck()
      cy.get('@insertFigureDialogButton').click()

      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'url',
          data: {
            url: 'https://my-fake-website.com/frog.jpg',
          },
        },
      })

      cy.get('.cm-selectionLayer .cm-selectionBackground').should(
        'have.length',
        1
      )

      // If label is selected then typing will replace the whole label
      cy.focused().type('fig:my-label')

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit    \\label{fig:my-label}\\end{figure}'
      )
    })

    it('Places the cursor after the figure if it is inserted without a caption or a label', function () {
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.get('@include-caption-checkbox').uncheck()
      cy.get('@include-label-checkbox').uncheck()

      cy.get('@insertFigureDialogButton').click()

      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'url',
          data: {
            url: 'https://my-fake-website.com/frog.jpg',
          },
        },
      })

      // Note that we have to include the 'edit' text from the edit button's
      // icon, which is literal text in the document
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit\\end{figure}'
      )

      cy.focused().type('Some more text')

      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centeringedit\\end{figure}Some more text'
      )
    })
  })

  describe('Editing existing figure', function () {
    it('Parses existing label and caption', function () {
      cy.get('.cm-content').type(
        `\\begin{{}figure}
\\centering
\\includegraphics[width=0.5\\linewidth]{{}frog.jpg}
\\caption{{}My caption}
\\label{{}fig:my-label}
\\end{{}figure}`,
        { delay: 0 }
      )
      cy.get('[aria-label="Edit figure"]').click({ force: true })
      cy.findByRole('checkbox', { name: 'Include caption' }).should(
        'be.checked'
      )
      cy.findByRole('checkbox', { name: 'Include label' }).should('be.checked')
    })

    it('Parses existing width', function () {
      cy.get('.cm-content').type(
        `\\begin{{}figure}
\\centering
\\includegraphics[width=0.75\\linewidth]{{}frog.jpg}
\\caption{{}My caption}
\\label{{}fig:my-label}
\\end{{}figure}`,
        { delay: 0 }
      )
      cy.get('[aria-label="Edit figure"]').click({ force: true })
      cy.get('[value="0.75"]').should('be.checked')
    })

    it('Removes existing label when unchecked', function () {
      cy.get('.cm-content').type(
        `\\begin{{}figure}
\\centering
\\includegraphics[width=0.75\\linewidth]{{}frog.jpg}
\\label{{}fig:my-label}
\\end{{}figure}`,
        { delay: 0 }
      )
      cy.get('[aria-label="Edit figure"]').click({ force: true })
      cy.findByRole('checkbox', { name: 'Include label' }).click()
      cy.findByRole('checkbox', { name: 'Include label' }).should(
        'not.be.checked'
      )
      cy.findByText('Done').click()
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}\\centering\\includegraphics[width=0.75\\linewidth]{frog.jpg}\\end{figure}'
      )
    })

    it('Removes existing caption when unchecked', function () {
      cy.get('.cm-content').type(
        `\\begin{{}figure}
\\centering
\\includegraphics[width=0.75\\linewidth]{{}frog.jpg}
\\caption{{}My caption}
\\label{{}fig:my-label}
\\end{{}figure}`,
        { delay: 0 }
      )
      cy.get('[aria-label="Edit figure"]').click({ force: true })
      cy.findByRole('checkbox', { name: 'Include caption' }).click()
      cy.findByRole('checkbox', { name: 'Include caption' }).should(
        'not.be.checked'
      )
      cy.findByText('Done').click()
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}\\centering\\includegraphics[width=0.75\\linewidth]{frog.jpg}🏷fig:my-label\\end{figure}'
      )
    })

    it('Preserves other content when removing figure', function () {
      cy.get('.cm-content').type(
        `text above
\\begin{{}figure}
\\centering
\\includegraphics[width=0.75\\linewidth]{{}frog.jpg}
\\caption{{}My caption}
\\label{{}fig:my-label}
\\end{{}figure}
text below`,
        { delay: 0 }
      )
      cy.get('[aria-label="Edit figure"]').click({ force: true })
      cy.findByRole('button', { name: 'Remove or replace figure' }).click()
      cy.findByText('Delete figure').click()
      cy.get('.cm-content').should('have.text', 'text abovetext below')
    })

    it('Opens figure modal on pasting image', function () {
      cy.fixture<Uint8Array<ArrayBuffer>>('images/gradient.png').then(
        gradientBuffer => {
          const gradientFile = new File([gradientBuffer], 'gradient.png', {
            type: 'image/png',
          })
          const clipboardData = new DataTransfer()
          clipboardData.items.add(gradientFile)
          cy.wrap(clipboardData.files).should('have.length', 1)
          cy.get('.cm-content').trigger('paste', { clipboardData })
          cy.findByText('Upload from computer').should('be.visible')
          cy.findByLabelText('File name in this project').should(
            'have.value',
            'gradient.png'
          )
        }
      )
    })

    // TODO: Add tests for replacing image when we can match on image path
    // TODO: Add tests for changing image size when we can match on figure width

    it('Switches from includegraphics to includesvg when replacing with SVG file', function () {
      cy.interceptLinkedFile()

      cy.get('.cm-content').type(
        `\\begin{{}figure}
\\centering
\\includegraphics[width=0.75\\linewidth]{{}frog.jpg}
\\caption{{}My caption}
\\label{{}fig:my-label}
\\end{{}figure}`,
        { delay: 0 }
      )
      cy.get('[aria-label="Edit figure"]').click({ force: true })
      cy.findByRole('button', { name: 'Remove or replace figure' }).click()
      cy.findByText('Replace from URL').click()
      cy.findByLabelText('Image URL').type('https://example.com/diagram.svg')
      cy.findByText('Insert figure').click()

      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'url',
          data: {
            url: 'https://example.com/diagram.svg',
          },
        },
      })

      // Note: \caption and \label render as widgets in visual editor
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}\\centering\\includesvg[width=0.75\\linewidth]{diagram}My caption🏷fig:my-label\\end{figure}'
      )
    })
  })

  describe('SVG file handling', function () {
    beforeEach(function () {
      // Intercept the fetch request for the SVG blob
      cy.intercept('GET', '/project/test-project/blob/abc123', {
        statusCode: 200,
        body: svgContent,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }).as('svgFetch')
    })

    describe('inserting SVG from URL', function () {
      beforeEach(function () {
        cy.interceptLinkedFile()
        clickFigureToolbarButton()
        cy.findByRole('menu').within(() => {
          cy.findByText('From URL').click()
        })
        cy.findByLabelText('Image URL').as('image-url-input')
        findInsertFigureDialogButton()
      })

      it('uses includesvg command for SVG files and displays the file', function () {
        cy.get('@image-url-input').type('https://example.com/diagram.svg')
        cy.get('@insertFigureDialogButton').click()

        cy.get('@linked-file-request').should('have.been.calledWithMatch', {
          body: {
            provider: 'url',
            data: {
              url: 'https://example.com/diagram.svg',
            },
          },
        })

        cy.get('[aria-label="Edit figure"]').should('exist')
        cy.get('.ol-cm-environment-figure[data-filepath="diagram"]').should(
          'exist'
        )
        cy.get('.cm-content').should(
          'have.text',
          '\\begin{figure}    \\centeringedit    \\caption{Enter Caption}    🏷fig:placeholder\\end{figure}'
        )
      })
    })

    describe('editing existing SVG figure', function () {
      it('parses existing includesvg with width, label, and caption', function () {
        cy.get('.cm-content').type(
          `\\begin{{}figure}
\\centering
\\includesvg[width=0.75\\linewidth]{{}diagram}
\\caption{{}My SVG caption}
\\label{{}fig:svg-label}
\\end{{}figure}`,
          { delay: 0 }
        )
        cy.get('[aria-label="Edit figure"]').click({ force: true })
        cy.get('[value="0.75"]').should('be.checked')
        cy.findByRole('checkbox', { name: 'Include caption' }).should(
          'be.checked'
        )
        cy.findByRole('checkbox', { name: 'Include label' }).should(
          'be.checked'
        )
      })

      it('removes existing label from includesvg figure when unchecked', function () {
        cy.get('.cm-content').type(
          `\\begin{{}figure}
\\centering
\\includesvg[width=0.75\\linewidth]{{}diagram}
\\label{{}fig:my-label}
\\end{{}figure}`,
          { delay: 0 }
        )
        cy.get('[aria-label="Edit figure"]').click({ force: true })
        cy.findByRole('checkbox', { name: 'Include label' }).click()
        cy.findByRole('checkbox', { name: 'Include label' }).should(
          'not.be.checked'
        )
        cy.findByText('Done').click()
        cy.get('.cm-content').should(
          'have.text',
          '\\begin{figure}\\centering\\includesvg[width=0.75\\linewidth]{diagram}\\end{figure}'
        )
      })

      it('switches from includesvg to includegraphics when replacing with non-SVG file', function () {
        cy.interceptLinkedFile()

        cy.get('.cm-content').type(
          `\\begin{{}figure}
\\centering
\\includesvg[width=0.75\\linewidth]{{}diagram}
\\caption{{}My caption}
\\label{{}fig:my-label}
\\end{{}figure}`,
          { delay: 0 }
        )
        cy.get('[aria-label="Edit figure"]').click({ force: true })
        cy.findByRole('button', { name: 'Remove or replace figure' }).click()
        cy.findByText('Replace from URL').click()
        cy.findByLabelText('Image URL').type('https://example.com/photo.jpg')
        cy.findByText('Insert figure').click()

        cy.get('@linked-file-request').should('have.been.calledWithMatch', {
          body: {
            provider: 'url',
            data: {
              url: 'https://example.com/photo.jpg',
            },
          },
        })

        // Should switch to includegraphics for non-SVG files
        cy.get('.cm-content').should('contain.text', '\\includegraphics')
        cy.get('.cm-content').should('not.contain.text', '\\includesvg')
      })
    })
  })
})
