package uk.ac.ic.wlgitbridge.writelatex;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshotCallback;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

/**
 * Created by Winston on 16/11/14.
 */
public class WLDirectoryNodeSnapshot implements CandidateSnapshot {

    private final int previousVersionID;
    private final String projectName;
    private final WLDirectoryNode directoryNode;
    private final CandidateSnapshotCallback callback;

    public WLDirectoryNodeSnapshot(WLProject project, WLDirectoryNode directoryNode, CandidateSnapshotCallback callback) {
        previousVersionID = project.getLatestSnapshot().getVersionID();
        projectName = project.getName();
        this.directoryNode = directoryNode;
        this.callback = callback;
    }

    @Override
    public JsonElement getJsonRepresentation() {
        return null;
    }

    @Override
    public int getPreviousVersionID() {
        return previousVersionID;
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
