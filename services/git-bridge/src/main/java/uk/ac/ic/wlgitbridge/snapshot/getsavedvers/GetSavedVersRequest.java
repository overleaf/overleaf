package uk.ac.ic.wlgitbridge.snapshot.getsavedvers;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.base.HTTPMethod;

/**
 * Created by Winston on 06/11/14.
 */
public class GetSavedVersRequest extends SnapshotAPIRequest<GetSavedVersResult> {

    public static final String API_CALL = "/saved_vers";

    public GetSavedVersRequest(String projectName) {
        super(projectName, API_CALL);
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
