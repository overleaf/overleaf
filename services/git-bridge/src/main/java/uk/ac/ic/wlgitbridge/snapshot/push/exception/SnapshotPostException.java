package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

/*
 * Created by Winston on 16/11/14.
 */
public abstract class SnapshotPostException extends SnapshotAPIException {

  public SnapshotPostException() {}

  public SnapshotPostException(JsonElement jsonElement) {
    fromJSON(jsonElement);
  }
}
