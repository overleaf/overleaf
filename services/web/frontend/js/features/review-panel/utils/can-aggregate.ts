import {
  Change,
  DeleteOperation,
  InsertOperation,
} from '../../../../../types/change'

export const canAggregate = (
  deletion: Change<DeleteOperation>,
  insertion: Change<InsertOperation>
) =>
  deletion.metadata?.user_id &&
  // same user
  deletion.metadata?.user_id === insertion.metadata?.user_id &&
  // same position
  deletion.op.p === insertion.op.p + insertion.op.i.length
