package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback;

import com.google.gson.JsonObject;

/*
 * Created by Winston on 09/01/15.
 */
public abstract class SnapshotPostbackRequest {

  private final String code;

  public SnapshotPostbackRequest(String code) {
    this.code = code;
  }

  public JsonObject toJson() {
    JsonObject jsonThis = new JsonObject();
    jsonThis.addProperty("code", code);
    return jsonThis;
  }
}
