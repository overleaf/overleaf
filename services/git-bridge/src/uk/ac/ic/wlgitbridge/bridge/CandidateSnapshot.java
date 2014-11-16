package uk.ac.ic.wlgitbridge.bridge;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;

/**
 * Created by Winston on 16/11/14.
 */
public interface CandidateSnapshot {

    public JsonElement getJsonRepresentation();
    public int getPreviousVersionID();
    public String getProjectURL();
    public void approveWithVersionID(int versionID);
    public String getProjectName();
    public WLDirectoryNode getDirectoryNode();

}
