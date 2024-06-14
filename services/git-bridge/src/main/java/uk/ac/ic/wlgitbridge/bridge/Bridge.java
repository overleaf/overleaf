package uk.ac.ic.wlgitbridge.bridge;

import com.google.api.client.auth.oauth2.Credential;
import java.io.File;
import java.io.IOException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import uk.ac.ic.wlgitbridge.application.config.Config;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;
import uk.ac.ic.wlgitbridge.bridge.gc.GcJob;
import uk.ac.ic.wlgitbridge.bridge.gc.GcJobImpl;
import uk.ac.ic.wlgitbridge.bridge.lock.LockGuard;
import uk.ac.ic.wlgitbridge.bridge.lock.ProjectLock;
import uk.ac.ic.wlgitbridge.bridge.repo.*;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.resource.UrlResourceCache;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApi;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApiFacade;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJob;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.data.CandidateSnapshot;
import uk.ac.ic.wlgitbridge.data.CannotAcquireLockException;
import uk.ac.ic.wlgitbridge.data.ProjectLockImpl;
import uk.ac.ic.wlgitbridge.data.filestore.GitDirectoryContents;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.data.model.Snapshot;
import uk.ac.ic.wlgitbridge.git.exception.FileLimitExceededException;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.git.exception.SizeLimitExceededException;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.base.MissingRepositoryException;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.push.PostbackManager;
import uk.ac.ic.wlgitbridge.snapshot.push.PushResult;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.*;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * This is the heart of the Git Bridge. You plug in all the parts (project
 * lock, repo store, db store, swap store, snapshot api, resource cache and
 * postback manager) is called by Git user requests and Overleaf postback
 * requests.
 *
 * Follow these links to go "outward" (to input from Git users and Overleaf):
 *
 * 1. JGit hooks, which handle user Git requests:
 *
 *    @see WLRepositoryResolver - used on all requests associate a repo with a
 *                                project name, or fail
 *
 *     @see WLUploadPackFactory - used to handle clones and fetches
 *
 *    @see WLReceivePackFactory - used to handle pushes by setting a hook
 *    @see WriteLatexPutHook - the hook used to handle pushes
 *
 * 2. The Postback Servlet, which handles postbacks from the Overleaf app
 *    to confirm that a project is pushed. If a postback is lost, it's fine, we
 *    just update ourselves on the next access.
 *
 *    @see PostbackHandler - the entry point for postbacks
 *
 * Follow these links to go "inward" (to the Git Bridge components):
 *
 * 1. The Project Lock, used to synchronise accesses to projects and shutdown
 *    the Git Bridge gracefully by preventing further lock acquiring.
 *
 *    @see ProjectLock - the interface used for the Project Lock
 *    @see ProjectLockImpl - the default concrete implementation
 *
 * 2. The Repo Store, used to provide repository objects.
 *
 *    The default implementation uses Git on the file system.
 *
 *    @see RepoStore - the interface for the Repo Store
 *    @see FSGitRepoStore - the default concrete implementation
 *    @see ProjectRepo - an interface for an actual repo instance
 *    @see GitProjectRepo - the default concrete implementation
 *
 * 3. The DB Store, used to store persistent data such as the latest version
 *    of each project that we have (used for querying the Snapshot API), along
 *    with caching remote blobs.
 *
 *    The default implementation is SQLite based.
 *
 *    @see DBStore - the interface for the DB store
 *    @see SqliteDBStore - the default concrete implementation
 *
 * 4. The Swap Store, used to swap projects to when the disk goes over a
 *    certain data usage.
 *
 *    The default implementation tarbzips projects to/from Amazon S3.
 *
 *    @see SwapStore - the interface for the Swap Store
 *    @see S3SwapStore - the default concrete implementation
 *
 * 5. The Swap Job, which performs the actual swapping on the swap store based
 *    on various configuration options.
 *
 *    @see SwapJob - the interface for the Swap Job
 *    @see SwapJobImpl - the default concrete implementation
 *
 * 6. The Snapshot API, which provides data from the Overleaf app.
 *
 *    @see SnapshotApiFacade - wraps a concrete instance of the Snapshot API.
 *    @see SnapshotApi - the interface for the Snapshot API.
 *    @see NetSnapshotApi - the default concrete implementation
 *
 * 7. The Resource Cache, which provides the data for attachment resources from
 *    URLs. It will generally fetch from the source on a cache miss.
 *
 *    The default implementation uses the DB Store to maintain a mapping from
 *    URLs to files in an actual repo.
 *
 *    @see ResourceCache - the interface for the Resource Cache
 *    @see UrlResourceCache - the default concrete implementation
 *
 * 8. The Postback Manager, which keeps track of pending postbacks. It stores a
 *    mapping from project names to postback promises.
 *
 *    @see PostbackManager - the class
 *    @see PostbackPromise - the object waited on for a postback.
 *
 */
public class Bridge {

  private final Config config;

  private final ProjectLock lock;

  private final RepoStore repoStore;
  private final DBStore dbStore;
  private final SwapStore swapStore;
  private final SwapJob swapJob;
  private final GcJob gcJob;

  private final SnapshotApiFacade snapshotAPI;
  private final ResourceCache resourceCache;

  private final PostbackManager postbackManager;

  /*
   * Creates a Bridge from its configurable parts, which are the repo, db and
   * swap store, and the swap job config.
   *
   * This should be the method used to create a Bridge.
   * @param config The config to use
   * @param repoStore The repo store to use
   * @param dbStore The db store to use
   * @param swapStore The swap store to use
   * @param snapshotApi The snapshot api to use
   * @return The constructed Bridge.
   */
  public static Bridge make(
      Config config,
      RepoStore repoStore,
      DBStore dbStore,
      SwapStore swapStore,
      SnapshotApi snapshotApi) {
    ProjectLock lock =
        new ProjectLockImpl((int threads) -> Log.info("Waiting for " + threads + " projects..."));
    return new Bridge(
        config,
        lock,
        repoStore,
        dbStore,
        swapStore,
        SwapJob.fromConfig(config.getSwapJob(), lock, repoStore, dbStore, swapStore),
        new GcJobImpl(repoStore, lock),
        new SnapshotApiFacade(snapshotApi),
        new UrlResourceCache(dbStore));
  }

  /*
   * Creates a bridge from all of its components, not just its configurable
   * parts. This is for substituting mock/stub components for testing.
   * It's also used by Bridge.make to actually construct the bridge.
   * @param lock the {@link ProjectLock} to use
   * @param repoStore the {@link RepoStore} to use
   * @param dbStore the {@link DBStore} to use
   * @param swapStore the {@link SwapStore} to use
   * @param swapJob the {@link SwapJob} to use
   * @param gcJob
   * @param snapshotAPI the {@link SnapshotApi} to use
   * @param resourceCache the {@link ResourceCache} to use
   */
  Bridge(
      Config config,
      ProjectLock lock,
      RepoStore repoStore,
      DBStore dbStore,
      SwapStore swapStore,
      SwapJob swapJob,
      GcJob gcJob,
      SnapshotApiFacade snapshotAPI,
      ResourceCache resourceCache) {
    this.config = config;
    this.lock = lock;
    this.repoStore = repoStore;
    this.dbStore = dbStore;
    this.swapStore = swapStore;
    this.snapshotAPI = snapshotAPI;
    this.resourceCache = resourceCache;
    this.swapJob = swapJob;
    this.gcJob = gcJob;
    postbackManager = new PostbackManager();
    Runtime.getRuntime().addShutdownHook(new Thread(this::doShutdown));
    repoStore.purgeNonexistentProjects(dbStore.getProjectNames());
  }

  /*
   * This performs the graceful shutdown of the Bridge, which is called by the
   * shutdown hook. It acquires the project write lock, which prevents
   * work being done for new projects (which acquire the read lock).
   * Once it has the write lock, there are no readers left, so the git bridge
   * can shut down gracefully.
   *
   * It is also used by the tests.
   */
  void doShutdown() {
    Log.info("Shutdown received.");
    Log.info("Stopping SwapJob");
    swapJob.stop();
    Log.info("Stopping GcJob");
    gcJob.stop();
    Log.info("Waiting for projects");
    lock.lockAll();
    Log.info("Bye");
  }

  /*
   * Starts the swap job, which will begin checking whether projects should be
   * swapped with a configurable frequency.
   */
  public void startBackgroundJobs() {
    swapJob.start();
    gcJob.start();
  }

  public boolean healthCheck() {
    try {
      dbStore.getNumProjects();
      File rootDirectory = new File("/");
      if (!rootDirectory.exists()) {
        throw new Exception("bad filesystem state, root directory does not exist");
      }
      Log.debug("[HealthCheck] passed");
      return true;
    } catch (Exception e) {
      Log.error("[HealthCheck] FAILED!", e);
      return false;
    }
  }

  /*
   * Performs a check of inconsistencies in the DB. This was used to upgrade
   * the schema.
   */
  public void checkDB() {
    Log.info("Checking DB");
    File rootDir = repoStore.getRootDirectory();
    for (File f : rootDir.listFiles()) {
      if (f.getName().equals(".wlgb")) {
        continue;
      }
      String projName = f.getName();
      try (LockGuard __ = lock.lockGuard(projName)) {
        File dotGit = new File(f, ".git");
        if (!dotGit.exists()) {
          Log.warn("Project: {} has no .git", projName);
          continue;
        }
        ProjectState state = dbStore.getProjectState(projName);
        if (state != ProjectState.NOT_PRESENT) {
          continue;
        }
        Log.warn("Project: {} not in swap_store, adding", projName);
        dbStore.setLastAccessedTime(projName, new Timestamp(dotGit.lastModified()));
      } catch (CannotAcquireLockException e) {
        throw new RuntimeException(e);
      }
    }
  }

  /*
   * Synchronises the given repository with Overleaf.
   *
   * It acquires the project lock and calls
   * {@link #getUpdatedRepoCritical(Optional, String, GetDocResult)}.
   * @param oauth2 The oauth2 to use
   * @param projectName The name of the project
   * @throws IOException
   * @throws GitUserException
   */
  public ProjectRepo getUpdatedRepo(Optional<Credential> oauth2, String projectName)
      throws IOException, GitUserException, CannotAcquireLockException {
    try (LockGuard __ = lock.lockGuard(projectName)) {
      Optional<GetDocResult> maybeDoc = snapshotAPI.getDoc(oauth2, projectName);
      if (!maybeDoc.isPresent()) {
        throw new RepositoryNotFoundException(projectName);
      }
      GetDocResult doc = maybeDoc.get();
      Log.debug("[{}] Updating repository", projectName);
      return getUpdatedRepoCritical(oauth2, projectName, doc);
    }
  }

  /*
   * Synchronises the given repository with Overleaf.
   *
   * Pre: the project lock must be acquired for the given repo.
   *
   * 1. Queries the project state for the given project name.
   *    a. NOT_PRESENT = We've never seen it before, and the row for the
   *                     project doesn't even exist. The project definitely
   *                     exists because we would have aborted otherwise.
   *    b. PRESENT = The project is on disk.
   *    c. SWAPPED = The project is in the {@link SwapStore}
   *
   * If the project has never been cloned, it is git init'd. If the project
   * is in swap, it is restored to disk. Otherwise, the project was already
   * present.
   *
   * With the project present, snapshots are downloaded from the snapshot
   * API with {@link #updateProject(Optional, ProjectRepo)}.
   *
   * Then, the last accessed time of the project is set to the current time.
   * This is to support the LRU of the swap store.
   * @param oauth2
   * @param projectName The name of the project
   * @throws IOException
   * @throws GitUserException
   */
  private ProjectRepo getUpdatedRepoCritical(
      Optional<Credential> oauth2, String projectName, GetDocResult doc)
      throws IOException, GitUserException {
    ProjectRepo repo;
    ProjectState state = dbStore.getProjectState(projectName);
    switch (state) {
      case NOT_PRESENT:
        Log.info("[{}] Repo not present", projectName);
        repo = repoStore.initRepo(projectName);
        break;
      case SWAPPED:
        swapJob.restore(projectName);
        repo = repoStore.getExistingRepo(projectName);
        break;
      default:
        repo = repoStore.getExistingRepo(projectName);
    }
    updateProject(oauth2, repo);
    dbStore.setLastAccessedTime(projectName, Timestamp.valueOf(LocalDateTime.now()));
    return repo;
  }

  /*
   * The public call to push a project.
   *
   * It acquires the lock and calls {@link #pushCritical(
   *      Optional,
   *      String,
   *      RawDirectory,
   *      RawDirectory
   * )}, catching exceptions, logging, and rethrowing them.
   * @param oauth2 The oauth2 to use for the snapshot API
   * @param projectName The name of the project to push to
   * @param directoryContents The new contents of the project
   * @param oldDirectoryContents The old contents of the project
   * @param hostname
   * @throws SnapshotPostException
   * @throws IOException
   * @throws MissingRepositoryException
   * @throws ForbiddenException
   * @throws GitUserException
   */
  public void push(
      Optional<Credential> oauth2,
      String projectName,
      RawDirectory directoryContents,
      RawDirectory oldDirectoryContents,
      String hostname)
      throws SnapshotPostException,
          IOException,
          MissingRepositoryException,
          ForbiddenException,
          GitUserException,
          CannotAcquireLockException {
    Log.debug("[{}] pushing to Overleaf", projectName);
    try (LockGuard __ = lock.lockGuard(projectName)) {
      Log.info("[{}] got project lock", projectName);
      pushCritical(oauth2, projectName, directoryContents, oldDirectoryContents);
    } catch (SevereSnapshotPostException e) {
      Log.warn("[" + projectName + "] Failed to put to Overleaf", e);
      throw e;
    } catch (SnapshotPostException e) {
      /* Stack trace should be printed further up */
      Log.warn(
          "[{}] Exception when waiting for postback: {}",
          projectName,
          e.getClass().getSimpleName());
      throw e;
    } catch (IOException e) {
      Log.warn("[{}] IOException on put: {}", projectName, e);
      throw e;
    }

    gcJob.queueForGc(projectName);
  }

  /*
   * Does the work of pushing to a project, assuming the project lock is held.
   * The {@link WriteLatexPutHook} is the original caller, and when we return
   * without throwing, the commit is committed.
   *
   * We start off by creating a postback key, which is given in the url when
   * the Overleaf app tries to access the atts.
   *
   * Then creates a {@link CandidateSnapshot} from the old and new project
   * contents. The
   * {@link CandidateSnapshot} is created using
   * {@link #createCandidateSnapshot(String, RawDirectory, RawDirectory)},
   * which creates the snapshot object and writes the push files to the
   * atts directory, which is served by the {@link PostbackHandler}.
   * The files are deleted at the end of a try-with-resources block.
   *
   * Then 3 things are used to make the push request to the snapshot API:
   * 1. The oauth2
   * 2. The candidate snapshot
   * 3. The postback key
   *
   * If the snapshot API reports this as not successful, we immediately throw
   * an {@link OutOfDateException}, which goes back to the user.
   *
   * Otherwise, we wait (with a timeout) on a promise from the postback
   * manager, which can throw back to the user.
   *
   * If this is successful, we approve the snapshot with
   * {@link #approveSnapshot(int, CandidateSnapshot)}, which updates our side
   * of the push: the latest version and the URL index store.
   *
   * Then, we set the last accessed time for the swap store.
   *
   * Finally, after we return, the push to the repo from the hook is
   * successful and the repo gets updated.
   *
   * @param oauth2
   * @param projectName
   * @param directoryContents
   * @param oldDirectoryContents
   * @throws IOException
   * @throws MissingRepositoryException
   * @throws ForbiddenException
   * @throws SnapshotPostException
   * @throws GitUserException
   */
  private void pushCritical(
      Optional<Credential> oauth2,
      String projectName,
      RawDirectory directoryContents,
      RawDirectory oldDirectoryContents)
      throws IOException,
          MissingRepositoryException,
          ForbiddenException,
          SnapshotPostException,
          GitUserException {
    Optional<Long> maxFileNum = config.getRepoStore().flatMap(RepoStoreConfig::getMaxFileNum);
    if (maxFileNum.isPresent()) {
      long maxFileNum_ = maxFileNum.get();
      if (directoryContents.getFileTable().size() > maxFileNum_) {
        Log.warn(
            "[{}] Too many files: {}/{}",
            projectName,
            directoryContents.getFileTable().size(),
            maxFileNum_);
        throw new FileLimitExceededException(directoryContents.getFileTable().size(), maxFileNum_);
      }
    }
    Log.debug(
        "[{}] Pushing files ({} new, {} old)",
        projectName,
        directoryContents.getFileTable().size(),
        oldDirectoryContents.getFileTable().size());
    String postbackKey = postbackManager.makeKeyForProject(projectName);
    Log.debug("[{}] Created postback key: {}", projectName, postbackKey);
    try (CandidateSnapshot candidate =
        createCandidateSnapshot(projectName, directoryContents, oldDirectoryContents); ) {
      Log.debug("[{}] Candidate snapshot created: {}", projectName, candidate);
      PushResult result = snapshotAPI.push(oauth2, candidate, postbackKey);
      if (result.wasSuccessful()) {
        Log.debug("[{}] Push to Overleaf successful", projectName);
        Log.debug("[{}] Waiting for postback...", projectName);
        int versionID = postbackManager.waitForVersionIdOrThrow(projectName);
        Log.debug("[{}] Got version ID for push: {}", projectName, versionID);
        approveSnapshot(versionID, candidate);
        Log.debug("[{}] Approved version ID: {}", projectName, versionID);
        dbStore.setLastAccessedTime(projectName, Timestamp.valueOf(LocalDateTime.now()));
      } else {
        Log.warn("[{}] Went out of date while waiting for push", projectName);
        throw new OutOfDateException();
      }
    }
  }

  /*
   * A public call that should originate from the {@link FileHandler}.
   *
   * The {@link FileHandler} serves atts to the Overleaf app during a push.
   * The Overleaf app includes the postback key in the request, which was
   * originally given on a push request.
   *
   * This method checks that the postback key matches, and throws if not.
   *
   * The FileHandler should not serve the file if this throws.
   * @param projectName The project name that this key belongs to
   * @param postbackKey The key
   * @throws InvalidPostbackKeyException If the key doesn't match
   */
  public void checkPostbackKey(String projectName, String postbackKey)
      throws InvalidPostbackKeyException {
    postbackManager.checkPostbackKey(projectName, postbackKey);
  }

  /*
   * A public call that originates from the postback thread
   * {@link PostbackContents#processPostback()}, i.e. once the Overleaf app
   * has fetched all the atts and has committed the push and is happy, it
   * calls back here, fulfilling the promise that the push
   * {@link #push(Optional, String, RawDirectory, RawDirectory, String)}
   * is waiting on.
   *
   * The Overleaf app will have invented a new version for the push, which is
   * passed to the promise for the original push request to update the app.
   * @param projectName The name of the project being pushed to
   * @param postbackKey The postback key being used
   * @param versionID the new version id to use
   * @throws UnexpectedPostbackException if the postback key is invalid
   */
  public void postbackReceivedSuccessfully(String projectName, String postbackKey, int versionID)
      throws UnexpectedPostbackException {
    Log.debug(
        "[{}]" + " Postback received by postback thread, version: {}", projectName, versionID);
    postbackManager.postVersionIDForProject(projectName, versionID, postbackKey);
  }

  /*
   * As with {@link #postbackReceivedSuccessfully(String, String, int)},
   * but with an exception instead.
   *
   * This is based on the JSON body of the postback from the Overleaf app.
   *
   * The most likely problem is an {@link OutOfDateException}.
   * @param projectName The name of the project
   * @param postbackKey The postback key being used
   * @param exception The exception encountered
   * @throws UnexpectedPostbackException If the postback key is invalid
   */
  public void postbackReceivedWithException(
      String projectName, String postbackKey, SnapshotPostException exception)
      throws UnexpectedPostbackException {
    Log.warn("[{}] Postback received with exception", projectName);
    postbackManager.postExceptionForProject(projectName, exception, postbackKey);
  }

  /*
   * Delete a project's data
   */
  public void deleteProject(String projectName) {
    Log.info("[{}] deleting project", projectName);
    dbStore.deleteProject(projectName);
    try {
      repoStore.remove(projectName);
    } catch (IOException e) {
      Log.warn("Failed to delete repository for project {}: {}", projectName, e);
    }
    swapStore.remove(projectName);
  }

  /* PRIVATE */

  /*
   * Called by {@link #getUpdatedRepoCritical(Optional, String)}
   *
   * Does the actual work of getting the snapshots for a project from the
   * snapshot API and committing them to a repo.
   *
   * If any snapshots were found, sets the latest version for the project.
   *
   * @param oauth2
   * @param repo
   * @throws IOException
   * @throws GitUserException
   */
  private void updateProject(Optional<Credential> oauth2, ProjectRepo repo)
      throws IOException, GitUserException {
    String projectName = repo.getProjectName();
    int latestVersionId = dbStore.getLatestVersionForProject(projectName);
    Deque<Snapshot> snapshots = snapshotAPI.getSnapshots(oauth2, projectName, latestVersionId);

    makeCommitsFromSnapshots(repo, snapshots);

    // TODO: in case crashes around here, add an
    // "updating_from_commit" column to the DB as a way to rollback the
    // any failed partial updates before re-trying
    // Also need to consider the empty state (a new git init'd repo being
    // the rollback target)
    if (!snapshots.isEmpty()) {
      dbStore.setLatestVersionForProject(projectName, snapshots.getLast().getVersionID());
    }
  }

  /*
   * Called by {@link #updateProject(Optional, ProjectRepo)}.
   *
   * Performs the actual Git commits on the disk.
   *
   * Each commit adds files to the db store
   * ({@link ResourceCache#get(String, String, String, Map, Map, Optional)},
   * and then removes any files that were deleted.
   * @param repo The repository to commit to
   * @param snapshots The snapshots to commit
   * @throws IOException If an IOException occurred
   * @throws SizeLimitExceededException If one of the files was too big.
   */
  private void makeCommitsFromSnapshots(ProjectRepo repo, Collection<Snapshot> snapshots)
      throws IOException, GitUserException {
    String name = repo.getProjectName();
    Optional<Long> maxSize = config.getRepoStore().flatMap(RepoStoreConfig::getMaxFileSize);
    for (Snapshot snapshot : snapshots) {
      RawDirectory directory = repo.getDirectory();
      Map<String, RawFile> fileTable = directory.getFileTable();
      List<RawFile> files = new ArrayList<>();
      files.addAll(snapshot.getSrcs());
      for (RawFile file : files) {
        long size = file.size();
        /* Can't throw in ifPresent... */
        if (maxSize.isPresent()) {
          long maxSize_ = maxSize.get();
          if (size >= maxSize_) {
            throw new SizeLimitExceededException(Optional.of(file.getPath()), size, maxSize_);
          }
        }
      }
      Map<String, byte[]> fetchedUrls = new HashMap<>();
      for (SnapshotAttachment snapshotAttachment : snapshot.getAtts()) {
        files.add(
            resourceCache.get(
                name,
                snapshotAttachment.getUrl(),
                snapshotAttachment.getPath(),
                fileTable,
                fetchedUrls,
                maxSize));
      }
      Log.debug("[{}] Committing version ID: {}", name, snapshot.getVersionID());
      Collection<String> missingFiles =
          repo.commitAndGetMissing(
              new GitDirectoryContents(files, repoStore.getRootDirectory(), name, snapshot));
      dbStore.deleteFilesForProject(name, missingFiles.toArray(new String[missingFiles.size()]));
    }
  }

  /*
   * Called by
   * {@link #pushCritical(Optional, String, RawDirectory, RawDirectory)}.
   *
   * This call consists of 2 things: Creating the candidate snapshot,
   * and writing the atts to the atts directory.
   *
   * The candidate snapshot RAIIs away those atts (use try-with-resources).
   * @param projectName The name of the project
   * @param directoryContents The new directory contents
   * @param oldDirectoryContents The old directory contents
   * @return The {@link CandidateSnapshot} created
   * @throws IOException If an I/O exception occurred on writing
   */
  private CandidateSnapshot createCandidateSnapshot(
      String projectName, RawDirectory directoryContents, RawDirectory oldDirectoryContents)
      throws IOException {
    CandidateSnapshot candidateSnapshot =
        new CandidateSnapshot(
            projectName,
            dbStore.getLatestVersionForProject(projectName),
            directoryContents,
            oldDirectoryContents);
    candidateSnapshot.writeServletFiles(repoStore.getRootDirectory());
    return candidateSnapshot;
  }

  /*
   * Called by
   * {@link #pushCritical(Optional, String, RawDirectory, RawDirectory)}.
   *
   * This method approves a push by setting the latest version and removing
   * any deleted files from the db store (files were already added by the
   * resources cache).
   * @param versionID
   * @param candidateSnapshot
   */
  private void approveSnapshot(int versionID, CandidateSnapshot candidateSnapshot) {
    List<String> deleted = candidateSnapshot.getDeleted();
    dbStore.setLatestVersionForProject(candidateSnapshot.getProjectName(), versionID);
    dbStore.deleteFilesForProject(
        candidateSnapshot.getProjectName(), deleted.toArray(new String[deleted.size()]));
  }
}
