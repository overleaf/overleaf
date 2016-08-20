package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.IOException;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

/**
 * Created by winston on 20/08/2016.
 */
public class GitProjectRepo implements ProjectRepo {

    private final Repository repository;
    private final String projectName;

    public GitProjectRepo(Repository repository, String projectName) {
        this.repository = repository;
        this.projectName = projectName;
    }

    @Override
    public String getProjectName() {
        return projectName;
    }

    @Override
    public Map<String, RawFile> getFiles()
            throws IOException, GitUserException {
        return new RepositoryObjectTreeWalker(
                repository
        ).getDirectoryContents().getFileTable();
    }

    @Override
    public Collection<String> commitAndGetMissing(
            GitDirectoryContents contents
    ) throws IOException {
        try {
            return doCommitAndGetMissing(contents);
        } catch (GitAPIException e) {
            throw new IOException(e);
        }
    }

    private Collection<String> doCommitAndGetMissing(
            GitDirectoryContents contents
    ) throws IOException, GitAPIException {
        String name = getProjectName();
        Log.info("[{}] Writing commit", name);
        contents.write();
        Git git = new Git(repository);
        Log.info("[{}] Getting missing files", name);
        Set<String> missingFiles = git.status().call().getMissing();
        for (String missing : missingFiles) {
            Log.info("[{}] Git rm {}", name, missing);
            git.rm().setCached(true).addFilepattern(missing).call();
        }
        Log.info("[{}] Calling Git add", name);
        git.add().addFilepattern(".").call();
        Log.info("[{}] Calling Git commit", name);
        git.commit(
        ).setAuthor(
                new PersonIdent(
                        contents.getUserName(),
                        contents.getUserEmail(),
                        contents.getWhen(),
                        TimeZone.getDefault()
                )
        ).setMessage(
                contents.getCommitMessage()
        ).call();
        Log.info(
                "[{}] Deleting files in directory: {}",
                name,
                contents.getDirectory().getAbsolutePath()
        );
        Util.deleteInDirectoryApartFrom(contents.getDirectory(), ".git");
        return missingFiles;
    }

}
