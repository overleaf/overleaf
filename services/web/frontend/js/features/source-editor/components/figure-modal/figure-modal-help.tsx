import { FC } from 'react'

const LearnWikiLink: FC<{ article: string }> = ({ article, children }) => {
  return <a href={`/learn/latex/${article}`}>{children}</a>
}

export const FigureModalHelp = () => {
  return (
    <>
      <p>
        This tool helps you insert figures into your project without needing to
        write the LaTeX code. The following information explains more about the
        options in the tool and how to further customize your figures.
      </p>

      <b>Editing captions</b>
      <p>
        When you tick the box “Include caption” the image will be inserted into
        your document with a placeholder caption. To edit it, you simply select
        the placeholder text and type to replace it with your own.{' '}
      </p>

      <b>Understanding labels</b>
      <p>
        Labels help you to easily reference your figures throughout your
        document. To reference a figure within the text, reference the label
        using the <code>\ref&#123;...&#125;</code> command. This makes it easy
        to reference figures without needing to manually remember the figure
        numbering.{' '}
        <LearnWikiLink article="Inserting_Images#Labels_and_cross-references">
          Learn more
        </LearnWikiLink>
      </p>

      <b>Customizing figures</b>
      <p>
        There are lots of options to edit and customize your figures, such as
        wrapping text around the figure, rotating the image, or including
        multiple images in a single figure. You’ll need to edit the LaTeX code
        to do this.{' '}
        <LearnWikiLink article="Inserting_Images">Find out how</LearnWikiLink>
      </p>

      <b>Changing the position of your figure</b>
      <p>
        LaTeX places figures according to a special algorithm. You can use
        something called ‘placement parameters’ to influence the positioning of
        the figure.{' '}
        <LearnWikiLink article="Positioning_images_and_tables">
          Find out how
        </LearnWikiLink>
      </p>

      <b>Dealing with errors</b>
      <p>
        Are you getting an Undefined Control Sequence error? If you are, make
        sure you’ve loaded the graphicx package&mdash;
        <code>\usepackage&#123;graphicx&#125;</code>&mdash;in the preamble
        (first section of code) in your document.{' '}
        <LearnWikiLink article="Inserting_Images">Learn more</LearnWikiLink>
      </p>
    </>
  )
}
