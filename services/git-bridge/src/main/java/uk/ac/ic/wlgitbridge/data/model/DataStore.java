package uk.ac.ic.wlgitbridge.data.model;

import com.google.api.client.auth.oauth2.Credential;
import uk.ac.ic.wlgitbridge.bridge.ProjectRepo;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.SnapshotFetcher;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.model.db.PersistentStore;
import uk.ac.ic.wlgitbridge.data.model.db.SqlitePersistentStore;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.util.Log;
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
        Util.deleteInDirectoryApartFrom(
                rootGitDirectory,
                excludedFromDeletion.toArray(new String[] {})
        );

        snapshotFetcher = new SnapshotFetcher();
        resourceFetcher = new ResourceFetcher(persistentStore);
    }

    public void updateProjectWithName(
            Credential oauth2,
            ProjectRepo repo
    ) throws IOException, GitUserException {
        String projectName = repo.getProjectName();
        LinkedList<Snapshot> snapshots =
                snapshotFetcher.getSnapshotsForProjectAfterVersion(
                        oauth2,
                        projectName,
                        persistentStore.getLatestVersionForProject(projectName)
                );

        makeCommitsFromSnapshots(repo, snapshots);

        if (!snapshots.isEmpty()) {
            persistentStore.setLatestVersionForProject(
                    projectName,
                    snapshots.getLast().getVersionID()
            );
        }
    }

    private void makeCommitsFromSnapshots(ProjectRepo repo,
                                          List<Snapshot> snapshots)
            throws IOException, GitUserException {
        String name = repo.getProjectName();
        for (Snapshot snapshot : snapshots) {
            Map<String, RawFile> fileTable = repo.getFiles();
            List<RawFile> files = new LinkedList<>();
            files.addAll(snapshot.getSrcs());
            Map<String, byte[]> fetchedUrls = new HashMap<>();
            for (SnapshotAttachment snapshotAttachment : snapshot.getAtts()) {
                files.add(
                        resourceFetcher.get(
                                name,
                                snapshotAttachment.getUrl(),
                                snapshotAttachment.getPath(),
                                fileTable,
                                fetchedUrls
                        )
                );
            }
            Log.info(
                    "[{}] Committing version ID: {}",
                    name,
                    snapshot.getVersionID()
            );
            Collection<String> missingFiles = repo.commitAndGetMissing(
                    new GitDirectoryContents(
                            files,
                            rootGitDirectory,
                            name,
                            snapshot
                    )
            );
            persistentStore.deleteFilesForProject(
                    name,
                    missingFiles.toArray(new String[missingFiles.size()])
            );
        }
    }

    public CandidateSnapshot createCandidateSnapshot(
            String projectName,
            RawDirectory directoryContents,
            RawDirectory oldDirectoryContents
    ) throws SnapshotPostException,
             IOException {
        CandidateSnapshot candidateSnapshot = new CandidateSnapshot(
                projectName,
                persistentStore.getLatestVersionForProject(projectName),
                directoryContents,
                oldDirectoryContents
        );
        candidateSnapshot.writeServletFiles(rootGitDirectory);
        return candidateSnapshot;
    }

    public void approveSnapshot(int versionID,
                                CandidateSnapshot candidateSnapshot) {
        List<String> deleted = candidateSnapshot.getDeleted();
        persistentStore.setLatestVersionForProject(
                candidateSnapshot.getProjectName(),
                versionID
        );
        persistentStore.deleteFilesForProject(
                candidateSnapshot.getProjectName(),
                deleted.toArray(new String[deleted.size()])
        );
    }

    private File initRootGitDirectory(String rootGitDirectoryPath) {
        File rootGitDirectory = new File(rootGitDirectoryPath);
        rootGitDirectory.mkdirs();
        return rootGitDirectory;
    }

}
