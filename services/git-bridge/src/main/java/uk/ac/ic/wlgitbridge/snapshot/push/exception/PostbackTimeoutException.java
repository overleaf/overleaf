package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonElement;
import java.util.Arrays;
import java.util.List;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 09/01/15.
 */
public class PostbackTimeoutException extends SevereSnapshotPostException {

  private int timeout;

  public PostbackTimeoutException(int timeout) {
    this.timeout = timeout;
  }

  @Override
  public String getMessage() {
    return "Request timed out (after " + this.timeout + " seconds)";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(
        "The " + Util.getServiceName() + " server is currently unavailable.",
        "Please try again later.");
  }

  @Override
  public void fromJSON(JsonElement json) {}
}
