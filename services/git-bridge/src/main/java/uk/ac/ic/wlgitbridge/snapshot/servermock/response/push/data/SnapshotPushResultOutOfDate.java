package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotPushResultOutOfDate extends SnapshotPushResult {

  public SnapshotPushResultOutOfDate() {
    super(409, "outOfDate", "Out of Date");
  }

  @Override
  public boolean hasPostback() {
    return false;
  }
}
