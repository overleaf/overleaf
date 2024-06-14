package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback;

import com.google.gson.JsonObject;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotPostbackRequestSuccess extends SnapshotPostbackRequest {

  private final int latestVerId;

  public SnapshotPostbackRequestSuccess(int latestVerId) {
    super("upToDate");
    this.latestVerId = latestVerId;
  }

  @Override
  public JsonObject toJson() {
    JsonObject jsonThis = super.toJson();
    jsonThis.addProperty("latestVerId", latestVerId);
    return jsonThis;
  }
}
