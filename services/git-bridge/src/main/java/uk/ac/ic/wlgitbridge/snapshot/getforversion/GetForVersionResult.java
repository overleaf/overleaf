package uk.ac.ic.wlgitbridge.snapshot.getforversion;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.base.Result;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 06/11/14.
 */
public class GetForVersionResult extends Result {

  private SnapshotData snapshotData;

  public GetForVersionResult(Request request, JsonElement json) {
    super(request, json);
  }

  public GetForVersionResult(SnapshotData snapshotData) {
    this.snapshotData = snapshotData;
  }

  @Override
  public JsonElement toJson() {
    return snapshotData.toJson();
  }

  @Override
  public void fromJSON(JsonElement json) {
    snapshotData = new SnapshotData(json);
    Log.debug("GetForVersionResult({})", snapshotData);
  }

  public SnapshotData getSnapshotData() {
    return snapshotData;
  }
}
