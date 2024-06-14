package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonElement;
import java.util.Arrays;
import java.util.List;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 09/01/15.
 */
public class InternalErrorException extends SevereSnapshotPostException {

  @Override
  public String getMessage() {
    return "internal error";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(
        "There was an internal error with the Git server.",
        "Please contact " + Util.getServiceName() + ".");
  }

  @Override
  public void fromJSON(JsonElement json) {}
}
