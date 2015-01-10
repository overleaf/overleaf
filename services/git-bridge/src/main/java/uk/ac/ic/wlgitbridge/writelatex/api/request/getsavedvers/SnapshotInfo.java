package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

import uk.ac.ic.wlgitbridge.util.Util;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotInfo {

    private int versionId;
    private String comment;
    private WLUser user;
    private String createdAt;

    public SnapshotInfo(int versionID, String createdAt, String name, String email) {
        this(versionID, "Update on " + Util.getServiceName() + ".", name, email, createdAt);
    }

    public SnapshotInfo(int versionID, String comment, String email, String name, String createdAt) {
        versionId = versionID;
        this.comment = comment;
        user = new WLUser(name, email);
        this.createdAt = createdAt;
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
