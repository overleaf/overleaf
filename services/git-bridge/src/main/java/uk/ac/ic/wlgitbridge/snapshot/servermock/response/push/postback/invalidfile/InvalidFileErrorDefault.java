package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.invalidfile;

/*
 * Created by Winston on 09/01/15.
 */
public class InvalidFileErrorDefault extends InvalidFileError {

  public InvalidFileErrorDefault(String file) {
    super(file);
  }

  @Override
  protected String getState() {
    return "error";
  }
}
