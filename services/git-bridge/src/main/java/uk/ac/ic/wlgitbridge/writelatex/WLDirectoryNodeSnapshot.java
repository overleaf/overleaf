package uk.ac.ic.wlgitbridge.writelatex;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshotCallback;
import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

/**
 * Created by Winston on 16/11/14.
 */
public class WLDirectoryNodeSnapshot implements CandidateSnapshot {

    private final int previousVersionID;
    private final String projectName;
    private final String projectURL;
    private final WLDirectoryNode directoryNode;
    private final String postbackKey;
    private final CandidateSnapshotCallback callback;

    public WLDirectoryNodeSnapshot(WLProject project, WLDirectoryNode directoryNode, String hostname, String postbackKey, CandidateSnapshotCallback callback) {
        previousVersionID = project.getLatestSnapshotID();
        projectName = project.getName();
        projectURL = Util.getPostbackURL() + projectName;

        this.directoryNode = directoryNode;
        this.postbackKey = postbackKey;
        this.callback = callback;
    }

    @Override
    public JsonElement getJsonRepresentation() {
        JsonObject jsonObject = new JsonObject();
        jsonObject.addProperty("latestVerId", previousVersionID);
        jsonObject.add("files", getFilesAsJson());
        jsonObject.addProperty("postbackUrl", projectURL + "/" + postbackKey + "/postback");
        return jsonObject;
    }

    private JsonArray getFilesAsJson() {
        JsonArray filesArray = new JsonArray();
        for (FileNode fileNode : directoryNode.getFileNodes()) {
            filesArray.add(getFileAsJson(fileNode));
        }
        return filesArray;
    }

    private JsonObject getFileAsJson(FileNode fileNode) {
        JsonObject file = new JsonObject();
        file.addProperty("name", fileNode.getFilePath());
        if (fileNode.isChanged()) {
            file.addProperty("url", projectURL + "/" + fileNode.getFilePath() + "?key=" + postbackKey);
        }
        return file;
    }

    @Override
    public int getPreviousVersionID() {
        return previousVersionID;
    }

    @Override
    public String getProjectURL() {
        return projectURL;
    }

    @Override
    public void approveWithVersionID(int versionID) {
        callback.approveSnapshot(versionID, this);
    }

    @Override
    public String getProjectName() {
        return projectName;
    }

    @Override
    public WLDirectoryNode getDirectoryNode() {
        return directoryNode;
    }

}
