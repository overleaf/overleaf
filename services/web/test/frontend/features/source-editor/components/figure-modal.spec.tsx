import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { EditorProviders } from '../../../helpers/editor-providers'
import { mockScope, rootFolderId } from '../helpers/mock-scope'
import { FC } from 'react'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

const clickToolbarButton = (text: string) => {
  cy.findByLabelText(text).click()
  cy.findByLabelText(text).trigger('mouseout')
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
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'figure-modal': 'enabled',
    })
    window.metaAttributesCache.set(
      'ol-mathJax3Path',
      'https://unpkg.com/mathjax@3.2.2/es5/tex-svg-full.js'
    )
    cy.interceptEvents()
    cy.interceptSpelling()

    const content = ''

    const scope = mockScope(content)
    scope.editor.showVisual = true

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodemirrorEditor />
        </EditorProviders>
      </Container>
    )
  })

  describe('Upload from computer source', function () {
    beforeEach(function () {
      cy.interceptFileUpload()
      clickToolbarButton('Insert Figure')
      cy.findByRole('menu').within(() => {
        cy.findByText('Upload from computer').click()
      })
      cy.findByLabelText('File Uploader')
        .get('.uppy-Dashboard-input:first')
        .as('file-input')
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

      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centering    Enter Caption    🏷fig:enter-label\\end{figure}'
      )
    })

    it('Enables insert button when choosing file', function () {
      cy.findByText('Insert figure').should('be.disabled')
      chooseFileFromComputer()
      cy.findByText('Insert figure').should('be.enabled')
    })
  })

  describe('Upload from project files source', function () {
    beforeEach(function () {
      clickToolbarButton('Insert Figure')
      cy.findByRole('menu').within(() => {
        cy.findByText('From project files').click()
      })
    })

    it('Lists files from project', function () {
      cy.findByText('Select image from project files').click()
      cy.findByRole('listbox')
        .children()
        .should('have.length', 2)
        .should('contain.text', 'frog.jpg')
        .should('contain.text', 'unicorn.png')
        .should('contain.text', 'figures/')
    })

    it('Enables insert button when choosing file', function () {
      cy.findByText('Insert figure').should('be.disabled')
      cy.findByText('Select image from project files').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.findByText('Insert figure').should('be.enabled')
    })

    it('Inserts file when pressing insert button', function () {
      cy.findByText('Select image from project files').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.findByText('Insert figure').click()
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centering    Enter Caption    🏷fig:enter-label\\end{figure}'
      )
    })
  })

  describe('From another project source', function () {
    beforeEach(function () {
      cy.interceptProjectListing()
      cy.interceptCompile()
      cy.interceptLinkedFile()
      clickToolbarButton('Insert Figure')
      cy.findByRole('menu').within(() => {
        cy.findByText('From another project').click()
      })
      cy.findByText('Select a project').parent().as('project-dropdown')
      cy.findByText('Select a file').parent().as('file-dropdown')
    })

    it('List projects and files in projects', function () {
      cy.findByText('Insert figure').should('be.disabled')
      cy.get('@file-dropdown').should('have.class', 'disabled')
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').as('project-select')
      cy.get('@project-select').children().should('have.length', 2)
      cy.get('@project-select').within(() => {
        cy.findByText('My first project').click()
      })
      cy.get('@file-dropdown').should('not.have.class', 'disabled')
      cy.get('@file-dropdown').click()
      cy.findByRole('listbox').as('file-select')
      cy.get('@file-select').children().should('have.length', 2)
      cy.get('@file-select').should('contain.text', 'frog.jpg')
      cy.get('@file-select').should('contain.text', 'figures/unicorn.png')
      cy.get('@file-select').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.findByText('Insert figure').should('be.enabled')
    })

    it('Enables insert button when choosing file', function () {
      cy.findByText('Insert figure').should('be.disabled')
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('My first project').click()
      })
      cy.get('@file-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('frog.jpg').click()
      })
      cy.findByText('Insert figure').should('be.enabled')
    })

    it('Creates linked file when pressing insert', function () {
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('My first project').click()
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

      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centering    Enter Caption    🏷fig:enter-label\\end{figure}'
      )
    })

    it('Creates linked output file when pressing insert', function () {
      cy.get('@project-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('My first project').click()
      })
      cy.findByText('select from output files').click()
      cy.findByText('Select an output file').parent().as('output-file-dropdown')
      cy.get('@output-file-dropdown').click()
      cy.findByRole('listbox').within(() => {
        cy.findByText('output.pdf').click()
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

      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centering    Enter Caption    🏷fig:enter-label\\end{figure}'
      )
    })
  })

  describe('From URL source', function () {
    beforeEach(function () {
      cy.interceptLinkedFile()
      clickToolbarButton('Insert Figure')
      cy.findByRole('menu').within(() => {
        cy.findByText('From URL').click()
      })
      cy.findByLabelText('File name in this project').as(
        'relocated-file-name-input'
      )
      cy.findByLabelText('Image URL').as('image-url-input')
      cy.get('[data-cy="include-label-option"]').as('include-label-checkbox')
      cy.get('[data-cy="include-caption-option"]').as(
        'include-caption-checkbox'
      )
    })

    it('Auto fills name based on url', function () {
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.get('@relocated-file-name-input').should('have.value', 'frog.jpg')
      cy.get('@relocated-file-name-input').type('pig')
      cy.get('@relocated-file-name-input').should('have.value', 'pig.jpg')
    })

    it('Enables insert button when name and url is available', function () {
      cy.findByText('Insert figure').should('be.disabled')
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.findByText('Insert figure').should('be.enabled')
    })

    it('Adds linked file when pressing insert', function () {
      cy.get('@image-url-input').type('https://my-fake-website.com/frog.jpg')
      cy.findByText('Insert figure').click()

      cy.get('@linked-file-request').should('have.been.calledWithMatch', {
        body: {
          provider: 'url',
          data: {
            url: 'https://my-fake-website.com/frog.jpg',
          },
        },
      })

      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}    \\centering    Enter Caption    🏷fig:enter-label\\end{figure}'
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
      cy.get('[aria-label="Edit figure"]').click()
      cy.get('[data-cy="include-caption-option"]').should('be.checked')
      cy.get('[data-cy="include-label-option"]').should('be.checked')
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
      cy.get('[aria-label="Edit figure"]').click()
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
      cy.get('[aria-label="Edit figure"]').click()
      cy.get('[data-cy="include-label-option"]').click()
      cy.get('[data-cy="include-label-option"]').should('not.be.checked')
      cy.findByText('Done').click()
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}\\centering\\end{figure}'
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
      cy.get('[aria-label="Edit figure"]').click()
      cy.get('[data-cy="include-caption-option"]').click()
      cy.get('[data-cy="include-caption-option"]').should('not.be.checked')
      cy.findByText('Done').click()
      cy.get('.cm-content').should(
        'have.text',
        '\\begin{figure}\\centering🏷fig:my-label\\end{figure}'
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
      cy.get('[aria-label="Edit figure"]').click()
      cy.get('[aria-label="Remove or replace figure"]').click()
      cy.findByText('Delete figure').click()
      cy.get('.cm-content').should('have.text', 'text abovetext below')
    })

    // TODO: Add tests for replacing image when we can match on image path
    // TODO: Add tests for changing image size when we can match on figure width
  })
})
