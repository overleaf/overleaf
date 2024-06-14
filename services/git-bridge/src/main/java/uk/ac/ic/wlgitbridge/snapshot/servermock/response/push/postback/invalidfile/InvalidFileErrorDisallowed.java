package uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.invalidfile;

/*
 * Created by Winston on 09/01/15.
 */
public class InvalidFileErrorDisallowed extends InvalidFileError {

  public InvalidFileErrorDisallowed(String file) {
    super(file);
  }

  @Override
  protected String getState() {
    return "disallowed";
  }
}
