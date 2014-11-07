package uk.ac.ic.wlgitbridge.writelatex.model;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.WLFile;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotInfo;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.WLUser;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 03/11/14.
 */
public class Snapshot {

    private final int versionID;
    private final String comment;
    private final String userName;
    private final String userEmail;

    private final List<WLFile> srcs;
    private final List<WLFile> atts;

    public Snapshot(SnapshotInfo info, SnapshotData data) {
        versionID = info.getVersionId();
        comment = info.getComment();
        WLUser user = info.getUser();
        userName = user.getName();
        userEmail = user.getEmail();

        srcs = data.getSrcs();
        atts = data.getAtts();
    }

    public void writeToDisk(String basePath) throws InterruptedException, ExecutionException, IOException {
        for (WLFile file : srcs) {
            file.writeToDisk(basePath);
        }
        for (WLFile file : atts) {
            file.writeToDisk(basePath);
        }
    }

    public int getVersionID() {
        return versionID;
    }

    public String getComment() {
        return comment;
    }

    public String getUserName() {
        return userName;
    }

    public String getUserEmail() {
        return userEmail;
    }

}
