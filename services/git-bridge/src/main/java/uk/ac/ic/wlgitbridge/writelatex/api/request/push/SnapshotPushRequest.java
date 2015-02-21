package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 16/11/14.
 */
public class SnapshotPushRequest extends SnapshotAPIRequest<SnapshotPushRequestResult> {

    private static final String API_CALL = "/snapshots";

    private final CandidateSnapshot candidateSnapshot;
    private final String postbackKey;

    public SnapshotPushRequest(CandidateSnapshot candidateSnapshot, String postbackKey) {
        super(candidateSnapshot.getProjectName(), API_CALL);
        this.candidateSnapshot = candidateSnapshot;
        this.postbackKey = postbackKey;
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
    protected SnapshotPushRequestResult parseResponse(JsonElement json) throws FailedConnectionException {
        return new SnapshotPushRequestResult(this, json);
    }

}
