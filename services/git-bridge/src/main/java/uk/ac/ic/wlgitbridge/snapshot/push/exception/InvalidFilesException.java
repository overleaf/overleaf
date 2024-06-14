package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 16/11/14.
 */
public class InvalidFilesException extends SnapshotPostException {

  private List<String> descriptionLines;

  public InvalidFilesException(JsonObject json) {
    super(json);
  }

  @Override
  public String getMessage() {
    return "invalid files";
  }

  @Override
  public List<String> getDescriptionLines() {
    return descriptionLines;
  }

  @Override
  public void fromJSON(JsonElement json) {
    descriptionLines = new ArrayList<>();
    JsonArray errors = json.getAsJsonObject().get("errors").getAsJsonArray();
    descriptionLines.add(
        "You have "
            + errors.size()
            + " invalid files in your "
            + Util.getServiceName()
            + " project:");
    for (JsonElement error : errors) {
      descriptionLines.add(describeError(error.getAsJsonObject()));
    }
  }

  private String describeError(JsonObject jsonObject) {
    return jsonObject.get("file").getAsString() + " (" + describeFile(jsonObject) + ")";
  }

  private String describeFile(JsonObject file) {
    if (file.has("cleanFile")) {
      return describeCleanFile(file.get("cleanFile").getAsString());
    } else {
      return describeErrorState(file.get("state").getAsString());
    }
  }

  private String describeCleanFile(String cleanFile) {
    return "rename to: " + cleanFile;
  }

  private String describeErrorState(String state) {
    if (state.equals("disallowed")) {
      return "invalid file extension";
    } else {
      return "error";
    }
  }
}
