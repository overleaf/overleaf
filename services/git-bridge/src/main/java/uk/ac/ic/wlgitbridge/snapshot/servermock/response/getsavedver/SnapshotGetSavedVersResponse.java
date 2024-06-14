package uk.ac.ic.wlgitbridge.snapshot.servermock.response.getsavedver;

import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersResult;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.SnapshotResponse;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotGetSavedVersResponse extends SnapshotResponse {

  private final GetSavedVersResult state;

  public SnapshotGetSavedVersResponse(GetSavedVersResult state) {
    this.state = state;
  }

  @Override
  public String respond() {
    return state.toJson().toString();
  }
}
