package uk.ac.ic.wlgitbridge.snapshot.push;

import com.google.api.client.auth.oauth2.Credential;
import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.snapshot.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 16/11/14.
 */
public class PushRequest extends SnapshotAPIRequest<PushResult> {

  private static final String API_CALL = "/snapshots";

  private final CandidateSnapshot candidateSnapshot;
  private final String postbackKey;

  public PushRequest(Credential oauth2, CandidateSnapshot candidateSnapshot, String postbackKey) {
    super(candidateSnapshot.getProjectName(), API_CALL, oauth2);
    this.candidateSnapshot = candidateSnapshot;
    this.postbackKey = postbackKey;
    Log.debug(
        "PushRequest({}, {}, {})",
        "oauth2: <oauth2>",
        "candidateSnapshot: " + candidateSnapshot,
        "postbackKey: " + postbackKey);
  }

  @Override
  protected HTTPMethod httpMethod() {
    return HTTPMethod.POST;
  }

  @Override
  protected String getPostBody() {
    return candidateSnapshot.getJsonRepresentation(postbackKey).toString();
  }

  @Override
  protected PushResult parseResponse(JsonElement json) throws FailedConnectionException {
    return new PushResult(this, json);
  }
}
