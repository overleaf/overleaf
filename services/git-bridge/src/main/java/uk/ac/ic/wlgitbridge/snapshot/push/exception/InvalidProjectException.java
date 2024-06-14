package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import java.util.LinkedList;
import java.util.List;

/*
 * Created by Winston on 16/11/14.
 */
public class InvalidProjectException extends SnapshotPostException {

  private LinkedList<String> descriptionLines;

  public InvalidProjectException(JsonElement jsonElement) {
    super(jsonElement);
  }

  @Override
  public String getMessage() {
    return "invalid project";
  }

  @Override
  public List<String> getDescriptionLines() {
    return descriptionLines;
  }

  @Override
  public void fromJSON(JsonElement json) {
    descriptionLines = new LinkedList<String>();
    JsonArray errors = json.getAsJsonObject().get("errors").getAsJsonArray();
    for (JsonElement error : errors) {
      descriptionLines.add(error.getAsString());
    }
  }
}
