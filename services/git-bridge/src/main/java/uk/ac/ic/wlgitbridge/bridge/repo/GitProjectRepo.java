package uk.ac.ic.wlgitbridge.bridge.repo;

import com.google.common.base.Preconditions;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Project;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Created by winston on 20/08/2016.
 */
public class GitProjectRepo implements ProjectRepo {

    private final String projectName;
    private Optional<Repository> repository;

    public GitProjectRepo(String projectName) {
        Preconditions.checkArgument(Project.isValidProjectName(projectName));
        this.projectName = projectName;
        repository = Optional.empty();
    }

    @Override
    public String getProjectName() {
        return projectName;
    }

    @Override
    public void initRepo(
            RepoStore repoStore
    ) throws IOException {
        initRepositoryField(repoStore);
        Preconditions.checkState(repository.isPresent());
        Repository repo = this.repository.get();
        Preconditions.checkState(!repo.getObjectDatabase().exists());
        repo.create();
    }

    @Override
    public void useExistingRepository(
            RepoStore repoStore
    ) throws IOException {
        initRepositoryField(repoStore);
        Preconditions.checkState(repository.isPresent());
        Preconditions.checkState(
                repository.get().getObjectDatabase().exists()
        );
    }

    @Override
    public Map<String, RawFile> getFiles()
            throws IOException, SizeLimitExceededException {
        Preconditions.checkState(repository.isPresent());
        return new RepositoryObjectTreeWalker(
                repository.get()
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

    public void resetHard() throws IOException {
        Git git = new Git(getJGitRepository());
        try {
            git.reset().setMode(ResetCommand.ResetType.HARD).call();
        } catch (GitAPIException e) {
            throw new IOException(e);
        }
    }

    public Repository getJGitRepository() {
        return repository.get();
    }

    public File getDirectory() {
        return getJGitRepository().getWorkTree();
    }

    private void initRepositoryField(RepoStore repoStore) throws IOException {
        Preconditions.checkNotNull(repoStore);
        Preconditions.checkArgument(Project.isValidProjectName(projectName));
        Preconditions.checkState(!repository.isPresent());
        repository = Optional.of(createJGitRepository(repoStore, projectName));
    }

    private Repository createJGitRepository(
            RepoStore repoStore,
            String projName
    ) throws IOException {
        File repoDir = new File(repoStore.getRootDirectory(), projName);
        return new FileRepositoryBuilder().setWorkTree(repoDir).build();
    }

    private Collection<String> doCommitAndGetMissing(
            GitDirectoryContents contents
    ) throws IOException, GitAPIException {
        Preconditions.checkState(repository.isPresent());
        Repository repo = getJGitRepository();
        String name = getProjectName();
        Log.info("[{}] Writing commit", name);
        contents.write();
        Git git = new Git(getJGitRepository());
        Log.info("[{}] Getting missing files", name);
        Set<String> missingFiles = git.status().call().getMissing();
        for (String missing : missingFiles) {
            Log.info("[{}] Git rm {}", name, missing);
            git.rm().setCached(true).addFilepattern(missing).call();
        }
        Log.info("[{}] Calling Git add", name);
        git.add(
        ).setWorkingTreeIterator(
                new NoGitignoreIterator(repo)
        ).addFilepattern(".").call();
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
