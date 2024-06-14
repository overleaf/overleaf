package uk.ac.ic.wlgitbridge.snapshot.servermock.response.getdoc;

import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.SnapshotResponse;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotGetDocResponse extends SnapshotResponse {

  private final GetDocResult state;

  public SnapshotGetDocResponse(GetDocResult state) {
    this.state = state;
  }

  @Override
  public String respond() {
    return state.toJson().toString();
  }
}
