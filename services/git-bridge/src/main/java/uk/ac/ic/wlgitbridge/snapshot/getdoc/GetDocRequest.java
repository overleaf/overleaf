package uk.ac.ic.wlgitbridge.snapshot.getdoc;

import com.google.api.client.auth.oauth2.Credential;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 06/11/14.
 */
public class GetDocRequest extends SnapshotAPIRequest<GetDocResult> {

  public static final String API_CALL = "";

  public GetDocRequest(Credential oauth2, String projectName) {
    super(projectName, API_CALL, oauth2);
    Log.debug("GetDocRequest({}, {})", "oauth2: <oauth2>", "projectName: " + projectName);
  }

  public GetDocRequest(String projectName) {
    this(null, projectName);
  }

  @Override
  protected HTTPMethod httpMethod() {
    return HTTPMethod.GET;
  }

  @Override
  protected GetDocResult parseResponse(JsonElement json) throws FailedConnectionException {
    return new GetDocResult(this, json);
  }
}
