package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonElement;

/*
 * Created by Winston on 10/01/15.
 */
public abstract class SevereSnapshotPostException extends SnapshotPostException {

  public SevereSnapshotPostException() {
    super();
  }

  public SevereSnapshotPostException(JsonElement json) {
    super(json);
  }
}
