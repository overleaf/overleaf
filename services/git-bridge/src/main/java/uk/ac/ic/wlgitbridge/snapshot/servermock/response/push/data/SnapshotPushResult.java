package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/*
 * Created by Winston on 09/01/15.
 */
public abstract class SnapshotPushResult {

  private final int status;
  private final String code;
  private final String message;

  public SnapshotPushResult(int status, String code, String message) {
    this.status = status;
    this.code = code;
    this.message = message;
  }

  public JsonElement toJson() {
    JsonObject jsonThis = new JsonObject();
    jsonThis.addProperty("status", status);
    jsonThis.addProperty("code", code);
    jsonThis.addProperty("message", message);
    return jsonThis;
  }

  public abstract boolean hasPostback();
}
