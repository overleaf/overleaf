package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.JSONSource;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotInfo {

    private int versionId;
    private String comment;
    private WLUser user;
    private String createdAt;

    public SnapshotInfo(int versionID) {
        comment = "Update on WriteLatex.com.";
        user = new WLUser();
    }

    public int getVersionId() {
        return versionId;
    }

    public String getComment() {
        return comment;
    }

    public WLUser getUser() {
        return user;
    }

    public String getCreatedAt() {
        return createdAt;
    }

}
