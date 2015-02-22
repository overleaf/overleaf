package uk.ac.ic.wlgitbridge.writelatex.filestore;

import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.bridge.WritableRepositoryContents;
import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

import java.io.File;
import java.io.IOException;
import java.util.Date;
import java.util.List;

/**
 * Created by Winston on 14/11/14.
 */
public class GitDirectoryContents implements WritableRepositoryContents {

    private final List<RawFile> files;
    private final File gitDirectory;
    private final String userName;
    private final String userEmail;
    private final String commitMessage;
    private final Date when;

    public GitDirectoryContents(List<RawFile> files, File rootGitDirectory, String projectName, Snapshot snapshot) {
        this.files = files;
        gitDirectory = new File(rootGitDirectory, projectName);
        userName = snapshot.getUserName();
        userEmail = snapshot.getUserEmail();
        commitMessage = snapshot.getComment();
        when = snapshot.getCreatedAt();
    }

    @Override
    public void write() throws IOException {
        Util.deleteInDirectoryApartFrom(gitDirectory, ".git");
        for (RawFile fileNode : files) {
            fileNode.writeToDisk(gitDirectory);
        }
    }

    @Override
    public File getDirectory() {
        return gitDirectory;
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

    @Override
    public Date getWhen() {
        return when;
    }

}
