package uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.SnapshotAPIRequest;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetDocRequest extends SnapshotAPIRequest<SnapshotGetDocResult> {

    public static final String API_CALL = "";

    public SnapshotGetDocRequest(String projectName) {
        super(projectName, API_CALL);
    }

    @Override
    protected SnapshotGetDocResult parseResponse(JsonElement json) {
        return new SnapshotGetDocResult(this, json);
    }

}
