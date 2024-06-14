package uk.ac.ic.wlgitbridge.snapshot.getforversion;

import com.google.api.client.auth.oauth2.Credential;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 06/11/14.
 */
public class GetForVersionRequest extends SnapshotAPIRequest<GetForVersionResult> {

  public static final String API_CALL = "/snapshots";

  private int versionID;

  public GetForVersionRequest(Credential oauth2, String projectName, int versionID) {
    super(projectName, API_CALL + "/" + versionID, oauth2);
    this.versionID = versionID;
    Log.debug(
        "GetForVersionRequest({}, {}, {})",
        "oauth2: <oauth2>",
        "projectName: " + projectName,
        "versionID: " + versionID);
  }

  @Override
  protected HTTPMethod httpMethod() {
    return HTTPMethod.GET;
  }

  @Override
  protected GetForVersionResult parseResponse(JsonElement json) throws FailedConnectionException {
    return new GetForVersionResult(this, json);
  }

  public int getVersionID() {
    return versionID;
  }
}
