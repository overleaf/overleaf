package uk.ac.ic.wlgitbridge.snapshot.getsavedvers;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import uk.ac.ic.wlgitbridge.snapshot.base.Request;
import uk.ac.ic.wlgitbridge.snapshot.base.Result;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 06/11/14.
 */
public class GetSavedVersResult extends Result {

  private List<SnapshotInfo> savedVers;

  public GetSavedVersResult(Request request, JsonElement json) throws FailedConnectionException {
    super(request, json);
  }

  public GetSavedVersResult(List<SnapshotInfo> savedVers) {
    this.savedVers = savedVers;
  }

  @Override
  public JsonElement toJson() {
    JsonArray jsonThis = new JsonArray();
    for (SnapshotInfo savedVer : savedVers) {
      JsonObject jsonSavedVer = new JsonObject();
      jsonSavedVer.addProperty("versionId", savedVer.getVersionId());
      jsonSavedVer.addProperty("comment", savedVer.getComment());
      WLUser user = savedVer.getUser();
      JsonObject jsonUser = new JsonObject();
      jsonUser.addProperty("email", user.getEmail());
      jsonUser.addProperty("name", user.getName());
      jsonSavedVer.add("user", jsonUser);
      jsonSavedVer.addProperty("createdAt", savedVer.getCreatedAt());
      jsonThis.add(jsonSavedVer);
    }
    return jsonThis;
  }

  @Override
  public void fromJSON(JsonElement json) {
    Log.debug("GetSavedVersResult({})", json);
    savedVers = new ArrayList<>();
    for (JsonElement elem : json.getAsJsonArray()) {
      savedVers.add(new Gson().fromJson(elem.getAsJsonObject(), SnapshotInfo.class));
    }
  }

  public List<SnapshotInfo> getSavedVers() {
    return savedVers;
  }
}
