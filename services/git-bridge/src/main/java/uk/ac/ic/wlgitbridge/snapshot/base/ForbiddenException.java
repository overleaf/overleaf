package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;
import java.util.Arrays;
import java.util.List;
import uk.ac.ic.wlgitbridge.git.exception.SnapshotAPIException;

/*
 * Created by winston on 25/10/15.
 */
public class ForbiddenException extends SnapshotAPIException {

  @Override
  public void fromJSON(JsonElement json) {}

  @Override
  public String getMessage() {
    return "forbidden";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(getMessage());
  }
}
