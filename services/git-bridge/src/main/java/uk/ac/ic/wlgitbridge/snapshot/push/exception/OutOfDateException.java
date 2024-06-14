package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.Arrays;
import java.util.List;

/*
 * Created by Winston on 16/11/14.
 */
public class OutOfDateException extends SnapshotPostException {

  public OutOfDateException(JsonObject json) {
    super(json);
  }

  public OutOfDateException() {}

  @Override
  public String getMessage() {
    return "out of date";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList("out of date (shouldn't print this)");
  }

  @Override
  public void fromJSON(JsonElement json) {}
}
