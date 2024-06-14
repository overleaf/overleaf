package uk.ac.ic.wlgitbridge.snapshot.push;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.base.Result;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 16/11/14.
 */
public class PushResult extends Result {

  private boolean success;

  public PushResult(Request request, JsonElement json) throws FailedConnectionException {
    super(request, json);
  }

  @Override
  public JsonElement toJson() {
    return null;
  }

  public boolean wasSuccessful() {
    return success;
  }

  @Override
  public void fromJSON(JsonElement json) {
    Log.debug("PushResult({})", json);
    JsonObject responseObject = json.getAsJsonObject();
    String code = Util.getCodeFromResponse(responseObject);

    if (code.equals("accepted")) {
      success = true;
    } else if (code.equals("outOfDate")) {
      success = false;
    } else {
      throw new RuntimeException();
    }
  }
}
