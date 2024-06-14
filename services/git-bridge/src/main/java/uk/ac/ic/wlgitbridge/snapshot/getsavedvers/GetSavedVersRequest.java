package uk.ac.ic.wlgitbridge.snapshot.getsavedvers;

import com.google.api.client.auth.oauth2.Credential;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 06/11/14.
 */
public class GetSavedVersRequest extends SnapshotAPIRequest<GetSavedVersResult> {

  public static final String API_CALL = "/saved_vers";

  public GetSavedVersRequest(Credential oauth2, String projectName) {
    super(projectName, API_CALL, oauth2);
    Log.debug("GetSavedVersRequest({}, {})", "oauth2: <oauth2>", "projectName: " + projectName);
  }

  @Override
  protected HTTPMethod httpMethod() {
    return HTTPMethod.GET;
  }

  @Override
  protected GetSavedVersResult parseResponse(JsonElement json) throws FailedConnectionException {
    return new GetSavedVersResult(this, json);
  }
}
