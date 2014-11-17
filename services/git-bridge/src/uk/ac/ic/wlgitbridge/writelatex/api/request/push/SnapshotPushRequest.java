package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;

/**
 * Created by Winston on 16/11/14.
 */
public class SnapshotPushRequest extends SnapshotAPIRequest<SnapshotPushRequestResult> {

    private static final String API_CALL = "/snapshots";

    private final CandidateSnapshot candidateSnapshot;

    public SnapshotPushRequest(CandidateSnapshot candidateSnapshot) {
        super(candidateSnapshot.getProjectName(), API_CALL);
        this.candidateSnapshot = candidateSnapshot;
    }

    @Override
    protected HTTPMethod httpMethod() {
        return HTTPMethod.POST;
    }

    @Override
    protected String getPostBody() {
        return candidateSnapshot.getJsonRepresentation().toString();
    }

    @Override
    protected SnapshotPushRequestResult parseResponse(JsonElement json) throws FailedConnectionException {
        return new SnapshotPushRequestResult(this, json);
    }

}
