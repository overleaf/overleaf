package uk.ac.ic.wlgitbridge.snapshot.getforversion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import uk.ac.ic.wlgitbridge.snapshot.base.JSONSource;

/*
 * Created by Winston on 06/11/14.
 */
public class SnapshotAttachment implements JSONSource {

  private String url;
  private String path;

  public SnapshotAttachment(JsonElement json) {
    fromJSON(json);
  }

  @Override
  public String toString() {
    return "SnapshotAttachment(url: " + url + ", path: " + path + ")";
  }

  @Override
  public void fromJSON(JsonElement json) {
    JsonArray jsonArray = json.getAsJsonArray();
    url = jsonArray.get(0).getAsString();
    path = jsonArray.get(1).getAsString();
  }

  public String getUrl() {
    return url;
  }

  public String getPath() {
    return path;
  }

  /* For the Mock Snapshot server */

  public SnapshotAttachment(String url, String path) {
    this.url = url;
    this.path = path;
  }

  public JsonElement toJson() {
    JsonArray jsonThis = new JsonArray();
    jsonThis.add(new JsonPrimitive(url));
    jsonThis.add(new JsonPrimitive(getPath()));
    return jsonThis;
  }
}
