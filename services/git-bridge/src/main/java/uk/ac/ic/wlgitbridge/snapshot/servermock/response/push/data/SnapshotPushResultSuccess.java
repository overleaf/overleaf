package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotPushResultSuccess extends SnapshotPushResult {

  public SnapshotPushResultSuccess() {
    super(402, "accepted", "Accepted");
  }

  @Override
  public boolean hasPostback() {
    return true;
  }
}
