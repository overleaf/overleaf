package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.invalidfile;

import com.google.gson.JsonObject;

/*
 * Created by Winston on 09/01/15.
 */
public class InvalidFileErrorUnclean extends InvalidFileError {

  private final String cleanFile;

  public InvalidFileErrorUnclean(String file, String cleanFile) {
    super(file);
    this.cleanFile = cleanFile;
  }

  @Override
  public JsonObject toJson() {
    JsonObject jsonThis = super.toJson();
    jsonThis.addProperty("cleanFile", cleanFile);
    return jsonThis;
  }

  @Override
  protected String getState() {
    return "unclean_name";
  }
}
