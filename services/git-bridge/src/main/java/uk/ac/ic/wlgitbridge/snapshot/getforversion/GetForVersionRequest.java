package uk.ac.ic.wlgitbridge.snapshot.getforversion;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.snapshot.base.HTTPMethod;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;

/**
 * Created by Winston on 06/11/14.
 */
public class GetForVersionRequest extends SnapshotAPIRequest<GetForVersionResult> {

    public static final String API_CALL = "/snapshots";

    private int versionID;

    public GetForVersionRequest(String projectName, int versionID) {
        super(projectName, API_CALL + "/" + versionID);
        this.versionID = versionID;
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
