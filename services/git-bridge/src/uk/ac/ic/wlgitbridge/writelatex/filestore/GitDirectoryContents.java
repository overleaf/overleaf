package uk.ac.ic.wlgitbridge.writelatex.filestore;

import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.node.FileNode;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

import java.io.File;
import java.io.IOException;
import java.util.List;

/**
 * Created by Winston on 14/11/14.
 */
public class GitDirectoryContents implements WritableRepositoryContents {

    private final List<FileNode> fileNodes;
    private final File gitDirectory;
    private final String userName;
    private final String userEmail;
    private final String commitMessage;

    public GitDirectoryContents(List<FileNode> fileNodes, File rootGitDirectory, String projectName, Snapshot snapshot) {
        this.fileNodes = fileNodes;
        gitDirectory = new File(rootGitDirectory, projectName);
        userName = snapshot.getUserName();
        userEmail = snapshot.getUserEmail();
        commitMessage = snapshot.getComment();
    }

    @Override
    public void write() throws IOException, FailedConnectionException {
        for (FileNode fileNode : fileNodes) {
            fileNode.writeToDisk(gitDirectory);
        }
    }

    @Override
    public String getUserName() {
        return userName;
    }

    @Override
    public String getUserEmail() {
        return userEmail;
    }

    @Override
    public String getCommitMessage() {
        return commitMessage;
    }

}
