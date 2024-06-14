package uk.ac.ic.wlgitbridge.snapshot.servermock.response;

/*
 * Created by Winston on 09/01/15.
 */
public abstract class SnapshotResponse {

  public abstract String respond();

  public String postback() {
    return null;
  }
}
