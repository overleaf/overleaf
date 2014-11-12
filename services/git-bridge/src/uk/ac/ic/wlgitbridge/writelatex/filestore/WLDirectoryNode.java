package uk.ac.ic.wlgitbridge.writelatex.filestore;

import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 08/11/14.
 */
public class WLDirectoryNode {

    private final Map<String, String> srcs;
    private final Map<String, String> atts;
    private final String rootGitDirectoryPath;

    public WLDirectoryNode(String rootGitDirectoryPath, String projectName) {
        this.rootGitDirectoryPath = rootGitDirectoryPath;
        srcs = new HashMap<String, String>();
        atts = new HashMap<String, String>();
    }

    public void updateFromProject(WLProject project) {
        updateFromLatestSnapshot(project.getLatestSnapshot());
    }

    private void updateFromLatestSnapshot(Snapshot snapshot) {

    }

}
