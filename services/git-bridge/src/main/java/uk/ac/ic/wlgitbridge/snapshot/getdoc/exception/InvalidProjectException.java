package uk.ac.ic.wlgitbridge.snapshot.getdoc.exception;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import java.util.LinkedList;
import java.util.List;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

/*
 * Created by Winston on 08/11/14.
 */
public class InvalidProjectException extends SnapshotAPIException {

  private List<String> errors;

  public InvalidProjectException() {
    super();
    errors = new LinkedList<String>();
  }

  @Override
  public String getMessage() {
    return "invalid project";
  }

  @Override
  public List<String> getDescriptionLines() {
    return errors;
  }

  @Override
  public void fromJSON(JsonElement json) {
    errors = new LinkedList<String>();
    JsonArray errors = json.getAsJsonObject().get("errors").getAsJsonArray();
    for (JsonElement error : errors) {
      this.errors.add(error.getAsString());
    }
  }
}
