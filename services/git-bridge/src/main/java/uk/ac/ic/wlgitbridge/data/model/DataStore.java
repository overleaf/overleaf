package uk.ac.ic.wlgitbridge.data.model;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Repository;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.SnapshotFetcher;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.model.db.PersistentStore;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.data.model.db.SqlitePersistentStore;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Created by Winston on 06/11/14.
 */
public class DataStore {

    private final File rootGitDirectory;
    private final PersistentStore persistentStore;
    private final SnapshotFetcher snapshotFetcher;
    private final ResourceFetcher resourceFetcher;

    public DataStore(String rootGitDirectoryPath) {
        rootGitDirectory = initRootGitDirectory(rootGitDirectoryPath);
        persistentStore = new SqlitePersistentStore(rootGitDirectory);
        List<String> excludedFromDeletion = persistentStore.getProjectNames();
        excludedFromDeletion.add(".wlgb");
        Util.deleteInDirectoryApartFrom(rootGitDirectory, excludedFromDeletion.toArray(new String[] {}));

        snapshotFetcher = new SnapshotFetcher();
        resourceFetcher = new ResourceFetcher(persistentStore);
    }

    public void updateProjectWithName(Credential oauth2, String name, Repository repository) throws IOException, SnapshotPostException, GitAPIException, ForbiddenException {
        LinkedList<Snapshot> snapshots = snapshotFetcher.getSnapshotsForProjectAfterVersion(oauth2, name, persistentStore.getLatestVersionForProject(name));

        makeCommitsFromSnapshots(name, repository, snapshots);

        if (!snapshots.isEmpty()) {
            persistentStore.setLatestVersionForProject(name, snapshots.getLast().getVersionID());
        }
    }

    private void makeCommitsFromSnapshots(String name, Repository repository, List<Snapshot> snapshots) throws IOException, GitAPIException {
        for (Snapshot snapshot : snapshots) {
            List<RawFile> files = new LinkedList<RawFile>();
            files.addAll(snapshot.getSrcs());
            Map<String, byte[]> fetchedUrls = new HashMap<String, byte[]>();
            for (SnapshotAttachment snapshotAttachment : snapshot.getAtts()) {
                files.add(resourceFetcher.get(name, snapshotAttachment.getUrl(), snapshotAttachment.getPath(), repository, fetchedUrls));
            }
            commit(name, new GitDirectoryContents(files, rootGitDirectory, name, snapshot), repository);
        }
    }

    private void commit(String name, GitDirectoryContents contents, Repository repository) throws IOException, GitAPIException {
        contents.write();
        Git git = new Git(repository);
        Set<String> missingFiles = git.status().call().getMissing();
        for (String missing : missingFiles) {
            git.rm().setCached(true).addFilepattern(missing).call();
        }
        git.add().addFilepattern(".").call();
        git.commit().setAuthor(new PersonIdent(contents.getUserName(), contents.getUserEmail(), contents.getWhen(), TimeZone.getDefault()))
                .setMessage(contents.getCommitMessage())
                .call();
        persistentStore.deleteFilesForProject(name, missingFiles.toArray(new String[missingFiles.size()]));
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

    public void approveSnapshot(int versionID, CandidateSnapshot candidateSnapshot) {
        List<String> deleted = candidateSnapshot.getDeleted();
        persistentStore.setLatestVersionForProject(candidateSnapshot.getProjectName(), versionID);
        persistentStore.deleteFilesForProject(candidateSnapshot.getProjectName(), deleted.toArray(new String[deleted.size()]));
    }

    private File initRootGitDirectory(String rootGitDirectoryPath) {
        File rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        return rootGitDirectory;
    }

}
