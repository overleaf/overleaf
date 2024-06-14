package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback;

import com.google.gson.JsonObject;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotPostbackRequestOutOfDate extends SnapshotPostbackRequest {

  public SnapshotPostbackRequestOutOfDate() {
    super("outOfDate");
  }

  @Override
  public JsonObject toJson() {
    JsonObject jsonThis = super.toJson();
    jsonThis.addProperty("message", "Out of Date");
    return jsonThis;
  }
}
