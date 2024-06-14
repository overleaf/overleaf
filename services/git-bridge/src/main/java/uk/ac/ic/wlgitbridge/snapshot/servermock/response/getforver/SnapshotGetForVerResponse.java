package uk.ac.ic.wlgitbridge.snapshot.servermock.response.getforver;

import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionResult;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.SnapshotResponse;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotGetForVerResponse extends SnapshotResponse {

  private final GetForVersionResult state;

  public SnapshotGetForVerResponse(GetForVersionResult state) {
    this.state = state;
  }

  @Override
  public String respond() {
    return state.toJson().toString();
  }
}
