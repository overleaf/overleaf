package uk.ac.ic.wlgitbridge.git.handler.hook.exception;

import com.google.gson.JsonElement;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;

/*
 * Created by Winston on 19/12/14.
 */
public class WrongBranchException extends SnapshotPostException {

  private final String branchName;

  public WrongBranchException(String expectedRef) {
    Objects.requireNonNull(expectedRef, "expectedRef must not be null");
    this.branchName = expectedRef.substring(expectedRef.lastIndexOf('/') + 1);
  }

  @Override
  public String getMessage() {
    return "wrong branch";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(
        "You can't push any new branches.", "Please use the " + branchName + " branch.");
  }

  @Override
  public void fromJSON(JsonElement json) {}
}
