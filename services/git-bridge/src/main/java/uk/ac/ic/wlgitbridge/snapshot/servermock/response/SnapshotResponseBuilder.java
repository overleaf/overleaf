package uk.ac.ic.wlgitbridge.snapshot.servermock.response;

import uk.ac.ic.wlgitbridge.snapshot.servermock.exception.InvalidAPICallException;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.getdoc.SnapshotGetDocResponse;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.getforver.SnapshotGetForVerResponse;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.getsavedver.SnapshotGetSavedVersResponse;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.SnapshotPushResponse;
import uk.ac.ic.wlgitbridge.snapshot.servermock.state.SnapshotAPIState;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotResponseBuilder {

  private SnapshotAPIState state;

  public SnapshotResponse buildWithTarget(String target, String method)
      throws InvalidAPICallException {
    checkPrefix(target);
    return parseTarget(target, target.split("/"), method);
  }

  private void checkPrefix(String target) throws InvalidAPICallException {
    if (!target.startsWith("/api/v0/docs/")) {
      throw new InvalidAPICallException(target);
    }
  }

  private SnapshotResponse parseTarget(String target, String[] parts, String method)
      throws InvalidAPICallException {
    String projectName = parts[4];
    if (parts.length == 5) {
      if (method.equals("GET")) {
        return new SnapshotGetDocResponse(state.getStateForGetDoc(projectName));
      }
    } else if (parts.length == 6) {
      String type = parts[5];
      if (type.equals("snapshots") && method.equals("POST")) {
        return new SnapshotPushResponse(
            state.getStateForPush(projectName), state.getStateForPostback(projectName));
      } else if (type.equals("saved_vers") && method.equals("GET")) {
        return new SnapshotGetSavedVersResponse(state.getStateForGetSavedVers(projectName));
      }
    } else if (parts.length == 7) {
      if (parts[5].equals("snapshots") && method.equals("GET")) {
        try {
          return new SnapshotGetForVerResponse(
              state.getStateForGetForVers(projectName, Integer.parseInt(parts[6])));
        } catch (NumberFormatException e) {

        }
      }
    }
    throw new InvalidAPICallException(target);
  }

  public void setState(SnapshotAPIState state) {
    this.state = state;
  }
}
