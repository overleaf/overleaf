package uk.ac.ic.wlgitbridge.writelatex.api.request;

import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotAPI;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetDocRequest extends SnapshotAPIRequest {

    public static final String API_CALL = "";

    public SnapshotGetDocRequest(String projectName) {
        super(projectName, API_CALL);
    }

}
