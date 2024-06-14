package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.Arrays;
import java.util.List;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 16/11/14.
 */
public class UnexpectedErrorException extends SevereSnapshotPostException {

  private static final String[] DESCRIPTION_LINES = {
    "There was an internal error with the " + Util.getServiceName() + " server.",
    "Please contact " + Util.getServiceName() + "."
  };

  public UnexpectedErrorException(JsonObject json) {
    super(json);
  }

  @Override
  public String getMessage() {
    return Util.getServiceName() + " error";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(DESCRIPTION_LINES);
  }

  @Override
  public void fromJSON(JsonElement json) {}
}
