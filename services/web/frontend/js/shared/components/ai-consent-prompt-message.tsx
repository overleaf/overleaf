import React from 'react'

interface ConsentPromptMessageBodyProps {
  className?: string
  listClassName?: string
}

interface ConsentPromptMessageHeaderProps {
  className?: string
}

export const AiConsentPromptMessageHeader = ({
  className,
}: ConsentPromptMessageHeaderProps) => {
  return (
    <div className={className}>
      Supporting your research and protecting your privacy
    </div>
  )
}

export const AiConsentPromptMessageBody = ({
  className,
  listClassName,
}: ConsentPromptMessageBodyProps) => {
  return (
    <div className={className}>
      <ul className={listClassName}>
        <li>
          AI features in Overleaf, like this one, can help you with writing your
          document and fixing errors.
        </li>
        <li>
          As some AI features are powered by third parties, your project
          content/data will be sent to those third parties in order to provide
          those features to you. However, your project content/data will not be
          used for model training. There are more details about how we use your
          data in{' '}
          <a
            href="https://docs.overleaf.com/integrations-and-add-ons/ai-features#data-privacy-and-responsible-use"
            target="_blank"
            rel="noreferrer"
          >
            our docs
          </a>
          .
        </li>
        <li>
          Like any AI, AI features in Overleaf can make mistakes, so please
          review all suggestions carefully before accepting them.
        </li>
      </ul>
      <p>
        By using these features, you approve the use and sharing of your data in
        this way.
      </p>
    </div>
  )
}
