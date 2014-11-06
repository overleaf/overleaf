package uk.ac.ic.wlgitbridge.writelatex.api.request;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetSavedVersRequest extends SnapshotAPIRequest {

    public static final String API_CALL = "/saved_vers";

    public SnapshotGetSavedVersRequest(String projectName) {
        super(projectName, API_CALL);
    }

}
