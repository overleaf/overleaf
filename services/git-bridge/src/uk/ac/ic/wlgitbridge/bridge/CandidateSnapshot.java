package uk.ac.ic.wlgitbridge.bridge;

import com.google.gson.JsonElement;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.WLDirectoryNode;

/**
 * Created by Winston on 16/11/14.
 */
public interface CandidateSnapshot {

    public JsonElement getJsonRepresentation();
    public void approveWithVersionID(int versionID);
    public WLDirectoryNode getDirectoryNode();

}
