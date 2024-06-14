package uk.ac.ic.wlgitbridge.git.handler.hook.exception;

import com.google.gson.JsonElement;
import java.util.Arrays;
import java.util.List;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;

/*
 * Created by Winston on 19/12/14.
 */
public class WrongBranchException extends SnapshotPostException {

  private static final String[] DESCRIPTION_LINES = {
    "You can't push any new branches.", "Please use the master branch."
  };

  @Override
  public String getMessage() {
    return "wrong branch";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(DESCRIPTION_LINES);
  }

  @Override
  public void fromJSON(JsonElement json) {}
}
