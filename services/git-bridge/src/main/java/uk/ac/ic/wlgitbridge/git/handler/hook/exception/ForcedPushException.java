package uk.ac.ic.wlgitbridge.git.handler.hook.exception;

import com.google.gson.JsonElement;
import java.util.Arrays;
import java.util.List;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 16/11/14.
 */
public class ForcedPushException extends SnapshotPostException {

  private static final String[] DESCRIPTION_LINES = {
    "You can't git push --force to a " + Util.getServiceName() + " project.",
    "Try to put your changes on top of the current head.",
    "If everything else fails, delete and reclone your repository, "
        + "make your changes, then push again."
  };

  @Override
  public String getMessage() {
    return "forced push prohibited";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(DESCRIPTION_LINES);
  }

  @Override
  public void fromJSON(JsonElement json) {}
}
