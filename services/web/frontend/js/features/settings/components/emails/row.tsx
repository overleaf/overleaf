import { UserEmailData } from '../../../../../../types/user-email'
import { Row, Col } from 'react-bootstrap'
import Email from './email'
import InstitutionAndRole from './institution-and-role'
import EmailCell from './cell'
import Actions from './actions'

type EmailsRowProps = {
  userEmailData: UserEmailData
}

function EmailsRow({ userEmailData }: EmailsRowProps) {
  return (
    <Row>
      <Col md={4}>
        <EmailCell>
          <Email userEmailData={userEmailData} />
        </EmailCell>
      </Col>
      <Col md={5}>
        {userEmailData.affiliation?.institution && (
          <EmailCell>
            <InstitutionAndRole userEmailData={userEmailData} />
          </EmailCell>
        )}
      </Col>
      <Col md={3}>
        <EmailCell className="text-md-right">
          <Actions userEmailData={userEmailData} />
        </EmailCell>
      </Col>
    </Row>
  )
}

export default EmailsRow
