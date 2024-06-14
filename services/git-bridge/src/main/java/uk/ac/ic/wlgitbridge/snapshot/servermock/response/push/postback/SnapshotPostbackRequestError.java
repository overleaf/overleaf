package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback;

import com.google.gson.JsonObject;

/*
 * Created by Winston on 10/01/15.
 */
public class SnapshotPostbackRequestError extends SnapshotPostbackRequest {

  public SnapshotPostbackRequestError() {
    super("error");
  }

  @Override
  public JsonObject toJson() {
    JsonObject jsonThis = super.toJson();
    jsonThis.addProperty("message", "Unexpected Error");
    return jsonThis;
  }
}
