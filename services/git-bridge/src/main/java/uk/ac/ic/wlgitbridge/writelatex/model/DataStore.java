package uk.ac.ic.wlgitbridge.writelatex.model;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.bridge.CandidateSnapshotCallback;
import uk.ac.ic.wlgitbridge.bridge.RawDirectory;
import uk.ac.ic.wlgitbridge.bridge.RawFile;
import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.writelatex.SnapshotFetcher;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.writelatex.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.writelatex.model.db.PersistentStore;

import java.io.File;
import java.io.IOException;
import java.util.LinkedList;
import java.util.List;
import java.util.TimeZone;

/**
 * Created by Winston on 06/11/14.
 */
public class DataStore implements CandidateSnapshotCallback {

    private final File rootGitDirectory;
    private final PersistentStore persistentStore;
    private final SnapshotFetcher snapshotFetcher;
    private final ResourceFetcher resourceFetcher;

    public DataStore(String rootGitDirectoryPath) {
        rootGitDirectory = initRootGitDirectory(rootGitDirectoryPath);
        persistentStore = new PersistentStore(rootGitDirectory);
        List<String> excludedFromDeletion = persistentStore.getProjectNames();
        excludedFromDeletion.add(".wlgb");
        Util.deleteInDirectoryApartFrom(rootGitDirectory, excludedFromDeletion.toArray(new String[]{}));

        snapshotFetcher = new SnapshotFetcher();
        resourceFetcher = new ResourceFetcher(persistentStore);
    }

    public void updateProjectWithName(String name, Repository repository) throws IOException, SnapshotPostException, GitAPIException {
        LinkedList<Snapshot> snapshots = snapshotFetcher.getSnapshotsForProjectAfterVersion(name, persistentStore.getLatestVersionForProject(name));
        if (!snapshots.isEmpty()) {
            persistentStore.setLatestVersionForProject(name, snapshots.getLast().getVersionID());
        }
        makeCommitsFromSnapshots(name, repository, snapshots);
    }

    private void makeCommitsFromSnapshots(String name, Repository repository, List<Snapshot> snapshots) throws IOException, GitAPIException {
        for (Snapshot snapshot : snapshots) {
            List<RawFile> files = new LinkedList<RawFile>();
            files.addAll(snapshot.getSrcs());
            for (SnapshotAttachment snapshotAttachment : snapshot.getAtts()) {
                files.add(resourceFetcher.get(name, snapshotAttachment.getUrl(), snapshotAttachment.getPath(), repository));
            }
            commit(new GitDirectoryContents(files, rootGitDirectory, name, snapshot), repository);
        }
    }

    private void commit(GitDirectoryContents contents, Repository repository) throws IOException, GitAPIException {
        contents.write();
        Git git = new Git(repository);
        for (String missing : git.status().call().getMissing()) {
            git.rm().setCached(true).addFilepattern(missing).call();
        }
        git.add().addFilepattern(".").call();
        git.commit().setAuthor(new PersonIdent(contents.getUserName(), contents.getUserEmail(), contents.getWhen(), TimeZone.getDefault()))
                .setMessage(contents.getCommitMessage())
                .call();
        Util.deleteInDirectoryApartFrom(contents.getDirectory(), ".git");
    }

    public CandidateSnapshot createCandidateSnapshotFromProjectWithContents(String projectName, RawDirectory directoryContents, RawDirectory oldDirectoryContents) throws SnapshotPostException, IOException, FailedConnectionException {
        CandidateSnapshot candidateSnapshot = new CandidateSnapshot(projectName,
                persistentStore.getLatestVersionForProject(projectName),
                directoryContents,
                oldDirectoryContents);
        candidateSnapshot.writeServletFiles(rootGitDirectory);
        return candidateSnapshot;
    }

    @Override
    public void approveSnapshot(int versionID, CandidateSnapshot candidateSnapshot) {
        persistentStore.setLatestVersionForProject(candidateSnapshot.getProjectName(), versionID);
    }

    private File initRootGitDirectory(String rootGitDirectoryPath) {
        File rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        return rootGitDirectory;
    }

}
