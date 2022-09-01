import { Button } from 'react-bootstrap'
import { FC, MouseEventHandler } from 'react'

export const RichTextSurveyInner: FC<{
  handleDismiss: MouseEventHandler<Button>
  openSurvey: () => void
}> = ({ handleDismiss, openSurvey }) => (
  <div className="alert alert-success rich-text-survey-warning" role="alert">
    <Button
      className="close"
      data-dismiss="alert"
      aria-label="Close"
      onClick={handleDismiss}
    >
      <span aria-hidden="true">&times;</span>
    </Button>
    <div className="warning-content">
      <div>
        <div className="warning-text">Have you used Rich Text mode?</div>
        <div className="warning-text">
          Please participate in our short survey.
        </div>
      </div>
      <div className="upgrade-prompt">
        <Button
          type="button"
          bsSize="sm"
          bsStyle="primary"
          onClick={openSurvey}
        >
          Take survey
        </Button>
      </div>
    </div>
  </div>
)
