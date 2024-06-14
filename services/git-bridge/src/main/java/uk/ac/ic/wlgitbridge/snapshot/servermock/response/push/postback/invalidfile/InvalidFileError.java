package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.invalidfile;

import com.google.gson.JsonObject;

/*
 * Created by Winston on 09/01/15.
 */
public abstract class InvalidFileError {

  private final String file;

  public InvalidFileError(String file) {
    this.file = file;
  }

  public JsonObject toJson() {
    JsonObject jsonThis = new JsonObject();
    jsonThis.addProperty("file", file);
    jsonThis.addProperty("state", getState());
    return jsonThis;
  }

  protected abstract String getState();

  public static InvalidFileError buildFromJsonError(JsonObject error) {
    String state = error.get("state").getAsString();
    String file = error.get("file").getAsString();
    if (state.equals("error")) {
      return new InvalidFileErrorDefault(file);
    } else if (state.equals("disallowed")) {
      return new InvalidFileErrorDisallowed(file);
    } else if (state.equals("unclean_name")) {
      return new InvalidFileErrorUnclean(file, error.get("cleanFile").getAsString());
    } else {
      throw new IllegalArgumentException("bad invalid file state: " + state);
    }
  }
}
