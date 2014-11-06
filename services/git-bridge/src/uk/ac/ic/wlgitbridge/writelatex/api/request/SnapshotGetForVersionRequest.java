package uk.ac.ic.wlgitbridge.writelatex.api.request;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetForVersionRequest extends SnapshotAPIRequest {

    public static final String API_CALL = "/snapshots";

    public SnapshotGetForVersionRequest(String projectName, int versionID) {
        super(projectName, API_CALL + "/" + versionID);
    }

}
