package uk.ac.ic.wlgitbridge.application;

import static org.asynchttpclient.Dsl.*;
import static org.junit.Assert.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.ParseException;
import org.apache.http.client.ClientProtocolException;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpHead;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.asynchttpclient.*;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJobConfig;
import uk.ac.ic.wlgitbridge.snapshot.servermock.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.snapshot.servermock.state.SnapshotAPIState;
import uk.ac.ic.wlgitbridge.snapshot.servermock.state.SnapshotAPIStateBuilder;
import uk.ac.ic.wlgitbridge.snapshot.servermock.util.FileUtil;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 11/01/15.
 */
public class WLGitBridgeIntegrationTest {

  private Runtime runtime = Runtime.getRuntime();

  private static final String PROJECT_ID = "000000000000000000000000";
  private static final String PROJECT_ID1 = "111111111111111111111111";
  private static final String PROJECT_ID2 = "222222222222222222222222";

  private Map<String, Map<String, SnapshotAPIState>> states =
      new HashMap<String, Map<String, SnapshotAPIState>>() {
        {
          put(
              "canCloneARepository",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canCloneARepository/state/state.json"))
                          .build());
                }
              });
          put(
              "canCloneMultipleRepositories",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canCloneMultipleRepositories/state/state.json"))
                          .build());
                }
              });
          put(
              "cannotCloneAProtectedProjectWithoutAuthentication",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/cannotCloneAProtectedProjectWithoutAuthentication/state/state.json"))
                          .build());
                }
              });
          put(
              "cannotCloneA4xxProject",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/cannotCloneA4xxProject/state/state.json"))
                          .build());
                }
              });
          put(
              "cannotCloneAMissingProject",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/cannotCloneAMissingProject/state/state.json"))
                          .build());
                }
              });
          put(
              "canPullAModifiedTexFile",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullAModifiedTexFile/base/state.json"))
                          .build());
                  put(
                      "withModifiedTexFile",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullAModifiedTexFile/withModifiedTexFile/state.json"))
                          .build());
                }
              });
          put(
              "canPullADeletedTexFile",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullADeletedTexFile/base/state.json"))
                          .build());
                  put(
                      "withDeletedTexFile",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullADeletedTexFile/withDeletedTexFile/state.json"))
                          .build());
                }
              });
          put(
              "canPullAModifiedBinaryFile",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullAModifiedBinaryFile/base/state.json"))
                          .build());
                  put(
                      "withModifiedBinaryFile",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullAModifiedBinaryFile/withModifiedBinaryFile/state.json"))
                          .build());
                }
              });
          put(
              "canPullADeletedBinaryFile",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullADeletedBinaryFile/base/state.json"))
                          .build());
                  put(
                      "withDeletedBinaryFile",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullADeletedBinaryFile/withDeletedBinaryFile/state.json"))
                          .build());
                }
              });
          put(
              "canPullADuplicateBinaryFile",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullADuplicateBinaryFile/base/state.json"))
                          .build());
                  put(
                      "withDuplicateBinaryFile",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullADuplicateBinaryFile/withDuplicateBinaryFile/state.json"))
                          .build());
                }
              });
          put(
              "canCloneDuplicateBinaryFiles",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canCloneDuplicateBinaryFiles/state/state.json"))
                          .build());
                }
              });
          put(
              "canPullUpdatedBinaryFiles",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullUpdatedBinaryFiles/base/state.json"))
                          .build());
                  put(
                      "withUpdatedBinaryFiles",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullUpdatedBinaryFiles/withUpdatedBinaryFiles/state.json"))
                          .build());
                }
              });
          put(
              "canPullAModifiedNestedFile",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullAModifiedNestedFile/base/state.json"))
                          .build());
                  put(
                      "withModifiedNestedFile",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullAModifiedNestedFile/withModifiedNestedFile/state.json"))
                          .build());
                }
              });
          put(
              "canPullDeletedNestedFiles",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullDeletedNestedFiles/base/state.json"))
                          .build());
                  put(
                      "withDeletedNestedFiles",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullDeletedNestedFiles/withDeletedNestedFiles/state.json"))
                          .build());
                }
              });
          put(
              "canPushFilesSuccessfully",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPushFilesSuccessfully/state/state.json"))
                          .build());
                }
              });
          put(
              "pushFailsOnFirstStageOutOfDate",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/pushFailsOnFirstStageOutOfDate/state/state.json"))
                          .build());
                }
              });
          put(
              "pushFailsOnSecondStageOutOfDate",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/pushFailsOnSecondStageOutOfDate/state/state.json"))
                          .build());
                }
              });
          put(
              "pushFailsOnInvalidFiles",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/pushFailsOnInvalidFiles/state/state.json"))
                          .build());
                }
              });
          put(
              "pushFailsOnInvalidProject",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/pushFailsOnInvalidProject/state/state.json"))
                          .build());
                }
              });
          put(
              "pushFailsOnUnexpectedError",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/pushFailsOnUnexpectedError/state/state.json"))
                          .build());
                }
              });
          put(
              "pushSucceedsAfterRemovingInvalidFiles",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "invalidState",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/pushSucceedsAfterRemovingInvalidFiles/invalidState/state.json"))
                          .build());
                  put(
                      "validState",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/pushSucceedsAfterRemovingInvalidFiles/validState/state.json"))
                          .build());
                }
              });
          put(
              "canServePushedFiles",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canServePushedFiles/state/state.json"))
                          .build());
                }
              });
          put(
              "wlgbCanSwapProjects",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/wlgbCanSwapProjects/state/state.json"))
                          .build());
                }
              });
          put(
              "pushSubmoduleFailsWithInvalidGitRepo",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/pushSubmoduleFailsWithInvalidGitRepo/state/state.json"))
                          .build());
                }
              });
          put(
              "canMigrateRepository",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canMigrateRepository/state/state.json"))
                          .build());
                }
              });
          put(
              "skipMigrationWhenMigratedFromMissing",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/skipMigrationWhenMigratedFromMissing/state/state.json"))
                          .build());
                }
              });
          put(
              "canCloneAMigratedRepositoryWithoutChanges",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canCloneAMigratedRepositoryWithoutChanges/state/state.json"))
                          .build());
                }
              });
          put(
              "rejectV1Repository",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/rejectV1Repository/state/state.json"))
                          .build());
                }
              });
          put(
              "cannotCloneAHasDotGitProject",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "state",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/cannotCloneAHasDotGitProject/state/state.json"))
                          .build());
                }
              });
          put(
              "canPullIgnoredForceAddedFile",
              new HashMap<String, SnapshotAPIState>() {
                {
                  put(
                      "base",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream("/canPullIgnoredForceAddedFile/base/state.json"))
                          .build());
                  put(
                      "withUpdatedMainFile",
                      new SnapshotAPIStateBuilder(
                              getResourceAsStream(
                                  "/canPullIgnoredForceAddedFile/withUpdatedMainFile/state.json"))
                          .build());
                }
              });
        }
      };

  @Rule public TemporaryFolder folder = new TemporaryFolder();

  private MockSnapshotServer server;
  private GitBridgeApp wlgb;
  private File dir;

  @Before
  public void setUp() throws Exception {
    dir = folder.newFolder();
  }

  @After
  public void tearDown() {
    if (server != null) {
      server.stop();
    }
    if (wlgb != null) {
      wlgb.stop();
    }
  }

  private void gitConfig(File dir) throws IOException, InterruptedException {
    assertEquals(0, runtime.exec("git config user.name TEST", null, dir).waitFor());
    assertEquals(0, runtime.exec("git config user.email test@test.com", null, dir).waitFor());
    assertEquals(0, runtime.exec("git config push.default matching", null, dir).waitFor());
  }

  private File gitClone(String repositoryName, int port, File dir)
      throws IOException, InterruptedException {
    String repo = "git clone http://git:password@127.0.0.1:" + port + "/" + repositoryName;
    Process gitProcess = runtime.exec(repo, null, dir);
    int exitCode = gitProcess.waitFor();
    if (exitCode != 0) {
      System.err.println("git clone failed. Dumping stderr and stdout.");
      System.err.println(IOUtils.toString(gitProcess.getErrorStream(), StandardCharsets.UTF_8));
      System.err.println(IOUtils.toString(gitProcess.getInputStream(), StandardCharsets.UTF_8));
      fail("git clone failed");
    }
    File repositoryDir = new File(dir, repositoryName);
    gitConfig(repositoryDir);
    return repositoryDir;
  }

  private void gitInit(File dir) throws IOException, InterruptedException {
    assertEquals(0, runtime.exec("git init", null, dir).waitFor());
    gitConfig(dir);
  }

  private void gitAdd(File dir) throws IOException, InterruptedException {
    assertEquals(0, runtime.exec("git add -A", null, dir).waitFor());
  }

  private void gitCommit(File dir, String msg) throws IOException, InterruptedException {
    assertEquals(0, runtime.exec("git commit -m \"" + msg + "\"", null, dir).waitFor());
  }

  private Process gitPush(File dir) throws IOException, InterruptedException {
    return gitPush(dir, 0);
  }

  private Process gitPush(File dir, int exit) throws IOException, InterruptedException {
    Process ret = runtime.exec("git push", null, dir);
    assertEquals(exit, ret.waitFor());
    return ret;
  }

  private void gitPull(File dir) throws IOException, InterruptedException {
    assertEquals(0, runtime.exec("git pull", null, dir).waitFor());
  }

  @Test
  public void canCloneARepository() throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3857, getResource("/canCloneARepository").toFile());
    server.start();
    server.setState(states.get("canCloneARepository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33857, 3857)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33857, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canCloneARepository/state/" + PROJECT_ID), testprojDir.toPath()));
  }

  @Test
  public void canCloneMultipleRepositories()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3858, getResource("/canCloneMultipleRepositories").toFile());
    server.start();
    server.setState(states.get("canCloneMultipleRepositories").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33858, 3858)});
    wlgb.run();
    File testproj1Dir = gitClone(PROJECT_ID1, 33858, dir);
    File testproj2Dir = gitClone(PROJECT_ID2, 33858, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canCloneMultipleRepositories/state/" + PROJECT_ID1),
            testproj1Dir.toPath()));
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canCloneMultipleRepositories/state/" + PROJECT_ID2),
            testproj2Dir.toPath()));
  }

  @Test
  public void canPullAModifiedTexFile() throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3859, getResource("/canPullAModifiedTexFile").toFile());
    server.start();
    server.setState(states.get("canPullAModifiedTexFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33859, 3859)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33859, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullAModifiedTexFile/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullAModifiedTexFile").get("withModifiedTexFile"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullAModifiedTexFile/withModifiedTexFile/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPullADeletedTexFile() throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3860, getResource("/canPullADeletedTexFile").toFile());
    server.start();
    server.setState(states.get("canPullADeletedTexFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33860, 3860)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33860, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullADeletedTexFile/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullADeletedTexFile").get("withDeletedTexFile"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullADeletedTexFile/withDeletedTexFile/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPullAModifiedBinaryFile()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3862, getResource("/canPullAModifiedBinaryFile").toFile());
    server.start();
    server.setState(states.get("canPullAModifiedBinaryFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33862, 3862)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33862, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullAModifiedBinaryFile/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullAModifiedBinaryFile").get("withModifiedBinaryFile"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullAModifiedBinaryFile/withModifiedBinaryFile/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPullADeletedBinaryFile()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3863, getResource("/canPullADeletedBinaryFile").toFile());
    server.start();
    server.setState(states.get("canPullADeletedBinaryFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33863, 3863)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33863, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullADeletedBinaryFile/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullADeletedBinaryFile").get("withDeletedBinaryFile"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullADeletedBinaryFile/withDeletedBinaryFile/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPullADuplicateBinaryFile()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(4001, getResource("/canPullADuplicateBinaryFile").toFile());
    server.start();
    server.setState(states.get("canPullADuplicateBinaryFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(44001, 4001)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 44001, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullADuplicateBinaryFile/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullADuplicateBinaryFile").get("withDuplicateBinaryFile"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullADuplicateBinaryFile/withDuplicateBinaryFile/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canCloneDuplicateBinaryFiles()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(4002, getResource("/canCloneDuplicateBinaryFiles").toFile());
    server.start();
    server.setState(states.get("canCloneDuplicateBinaryFiles").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(44002, 4002)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 44002, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canCloneDuplicateBinaryFiles/state/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPullUpdatedBinaryFiles()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(4003, getResource("/canPullUpdatedBinaryFiles").toFile());
    server.start();
    server.setState(states.get("canPullUpdatedBinaryFiles").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(44003, 4003)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 44003, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullUpdatedBinaryFiles/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullUpdatedBinaryFiles").get("withUpdatedBinaryFiles"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullUpdatedBinaryFiles/withUpdatedBinaryFiles/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPullAModifiedNestedFile()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3864, getResource("/canPullAModifiedNestedFile").toFile());
    server.start();
    server.setState(states.get("canPullAModifiedNestedFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33864, 3864)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33864, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullAModifiedNestedFile/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullAModifiedNestedFile").get("withModifiedNestedFile"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullAModifiedNestedFile/withModifiedNestedFile/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPullDeletedNestedFiles()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3865, getResource("/canPullDeletedNestedFiles").toFile());
    server.start();
    server.setState(states.get("canPullDeletedNestedFiles").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33865, 3865)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33865, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullDeletedNestedFiles/base/" + PROJECT_ID), testprojDir.toPath()));
    server.setState(states.get("canPullDeletedNestedFiles").get("withDeletedNestedFiles"));
    gitPull(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPullDeletedNestedFiles/withDeletedNestedFiles/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canPushFilesSuccessfully() throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3866, getResource("/canPushFilesSuccessfully").toFile());
    server.start();
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33866, 3866)});
    wlgb.run();
    server.setState(states.get("canPushFilesSuccessfully").get("state"));
    File testprojDir = gitClone(PROJECT_ID, 33866, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canPushFilesSuccessfully/state/" + PROJECT_ID), testprojDir.toPath()));
    assertEquals(0, runtime.exec("touch push.tex", null, testprojDir).waitFor());
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    gitPush(testprojDir);
  }

  private static final String EXPECTED_OUT_PUSH_OUT_OF_DATE_FIRST =
      "error: failed to push some refs to 'http://127.0.0.1:33867/"
          + PROJECT_ID
          + "'\n"
          + "hint: Updates were rejected because the tip of your current branch is behind\n"
          + "hint: its remote counterpart. If you want to integrate the remote changes,\n"
          + "hint: use 'git pull' before pushing again.\n"
          + "hint: See the 'Note about fast-forwards' in 'git push --help' for details.\n";

  @Test
  public void pushFailsOnFirstStageOutOfDate()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3867, getResource("/pushFailsOnFirstStageOutOfDate").toFile());
    server.start();
    server.setState(states.get("pushFailsOnFirstStageOutOfDate").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33867, 3867)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33867, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/pushFailsOnFirstStageOutOfDate/state/" + PROJECT_ID),
            testprojDir.toPath()));
    runtime.exec("touch push.tex", null, testprojDir).waitFor();
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    Process push = gitPush(testprojDir, 1);
    assertEquals(EXPECTED_OUT_PUSH_OUT_OF_DATE_FIRST, Util.fromStream(push.getErrorStream(), 2));
  }

  private static final String EXPECTED_OUT_PUSH_OUT_OF_DATE_SECOND =
      "error: failed to push some refs to 'http://127.0.0.1:33868/"
          + PROJECT_ID
          + "'\n"
          + "hint: Updates were rejected because the tip of your current branch is behind\n"
          + "hint: its remote counterpart. If you want to integrate the remote changes,\n"
          + "hint: use 'git pull' before pushing again.\n"
          + "hint: See the 'Note about fast-forwards' in 'git push --help' for details.\n";

  @Test
  public void pushFailsOnSecondStageOutOfDate()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3868, getResource("/pushFailsOnSecondStageOutOfDate").toFile());
    server.start();
    server.setState(states.get("pushFailsOnSecondStageOutOfDate").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33868, 3868)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33868, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/pushFailsOnSecondStageOutOfDate/state/" + PROJECT_ID),
            testprojDir.toPath()));
    runtime.exec("touch push.tex", null, testprojDir).waitFor();
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    Process push = gitPush(testprojDir, 1);
    assertEquals(EXPECTED_OUT_PUSH_OUT_OF_DATE_SECOND, Util.fromStream(push.getErrorStream(), 2));
  }

  private static final List<String> EXPECTED_OUT_PUSH_INVALID_FILES =
      Arrays.asList(
          "remote: hint: You have 4 invalid files in your Overleaf project:",
          "remote: hint: file1.invalid (error)",
          "remote: hint: file2.exe (invalid file extension)",
          "remote: hint: hello world.png (rename to: hello_world.png)",
          "remote: hint: an image.jpg (rename to: an_image.jpg)",
          "To http://127.0.0.1:33869/" + PROJECT_ID,
          "! [remote rejected] master -> master (invalid files)",
          "error: failed to push some refs to 'http://127.0.0.1:33869/" + PROJECT_ID + "'");

  @Test
  public void pushFailsOnInvalidFiles() throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3869, getResource("/pushFailsOnInvalidFiles").toFile());
    server.start();
    server.setState(states.get("pushFailsOnInvalidFiles").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33869, 3869)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33869, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/pushFailsOnInvalidFiles/state/" + PROJECT_ID), testprojDir.toPath()));
    runtime.exec("touch push.tex", null, testprojDir).waitFor();
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    Process push = gitPush(testprojDir, 1);
    List<String> actual = Util.linesFromStream(push.getErrorStream(), 2, "[K");
    assertEquals(EXPECTED_OUT_PUSH_INVALID_FILES, actual);
  }

  private static final List<String> EXPECTED_OUT_PUSH_INVALID_PROJECT =
      Arrays.asList(
          "remote: hint: project: no main file",
          "remote: hint: The project would have no (editable) main .tex file.",
          "To http://127.0.0.1:33870/" + PROJECT_ID,
          "! [remote rejected] master -> master (invalid project)",
          "error: failed to push some refs to 'http://127.0.0.1:33870/" + PROJECT_ID + "'");

  @Test
  public void pushFailsOnInvalidProject()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3870, getResource("/pushFailsOnInvalidProject").toFile());
    server.start();
    server.setState(states.get("pushFailsOnInvalidProject").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33870, 3870)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33870, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/pushFailsOnInvalidProject/state/" + PROJECT_ID), testprojDir.toPath()));
    runtime.exec("touch push.tex", null, testprojDir).waitFor();
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    Process push = gitPush(testprojDir, 1);
    List<String> actual = Util.linesFromStream(push.getErrorStream(), 2, "[K");
    assertEquals(EXPECTED_OUT_PUSH_INVALID_PROJECT, actual);
  }

  private static final List<String> EXPECTED_OUT_PUSH_UNEXPECTED_ERROR =
      Arrays.asList(
          "remote: hint: There was an internal error with the Overleaf server.",
          "remote: hint: Please contact Overleaf.",
          "To http://127.0.0.1:33871/" + PROJECT_ID,
          "! [remote rejected] master -> master (Overleaf error)",
          "error: failed to push some refs to 'http://127.0.0.1:33871/" + PROJECT_ID + "'");

  /* this one prints a stack trace */
  @Test
  public void pushFailsOnUnexpectedError()
      throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3871, getResource("/pushFailsOnUnexpectedError").toFile());
    server.start();
    server.setState(states.get("pushFailsOnUnexpectedError").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33871, 3871)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33871, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/pushFailsOnUnexpectedError/state/" + PROJECT_ID), testprojDir.toPath()));
    runtime.exec("touch push.tex", null, testprojDir).waitFor();
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    Process push = gitPush(testprojDir, 1);
    List<String> actual = Util.linesFromStream(push.getErrorStream(), 2, "[K");
    assertEquals(EXPECTED_OUT_PUSH_UNEXPECTED_ERROR, actual);
  }

  private static final List<String> EXPECTED_OUT_PUSH_INVALID_EXE_FILE =
      Arrays.asList(
          "remote: error: invalid files",
          "remote:",
          "remote: hint: You have 1 invalid files in your Overleaf project:",
          "remote: hint: file1.exe (invalid file extension)",
          "To http://127.0.0.1:33872/" + PROJECT_ID,
          "! [remote rejected] master -> master (invalid files)",
          "error: failed to push some refs to 'http://127.0.0.1:33872/" + PROJECT_ID + "'");

  @Test
  public void pushSucceedsAfterRemovingInvalidFiles()
      throws IOException, GitAPIException, InterruptedException {
    server =
        new MockSnapshotServer(
            3872, getResource("/pushSucceedsAfterRemovingInvalidFiles").toFile());
    server.start();
    server.setState(states.get("pushSucceedsAfterRemovingInvalidFiles").get("invalidState"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33872, 3872)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33872, dir);

    // try to push invalid file; it should fail
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/pushSucceedsAfterRemovingInvalidFiles/invalidState/" + PROJECT_ID),
            testprojDir.toPath()));
    assertEquals(0, runtime.exec("touch file1.exe", null, testprojDir).waitFor());
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    Process push = gitPush(testprojDir, 1);
    List<String> actual = Util.linesFromStream(push.getErrorStream(), 0, "[K");
    assertEquals(EXPECTED_OUT_PUSH_INVALID_EXE_FILE, actual);

    // remove invalid file and push again; it should succeed this time
    assertEquals(0, runtime.exec("git rm file1.exe", null, testprojDir).waitFor());
    gitCommit(testprojDir, "remove_invalid_file");
    server.setState(states.get("pushSucceedsAfterRemovingInvalidFiles").get("validState"));
    gitPush(testprojDir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/pushSucceedsAfterRemovingInvalidFiles/validState/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void canServePushedFiles() throws IOException, ExecutionException, InterruptedException {
    //
    // I don't think we can test this completely without some changes to the mock server, because we
    // have no way
    // of pausing the test while the push is in progress. Once the push is over, the file isn't
    // actually there for
    // us to fetch any more. We can however test the access and error conditions, which comprise
    // most of the logic.
    //
    int gitBridgePort = 33873;
    int mockServerPort = 3873;

    server = new MockSnapshotServer(mockServerPort, getResource("/canServePushedFiles").toFile());
    server.start();
    server.setState(states.get("canServePushedFiles").get("state"));

    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();

    File testprojDir = gitClone(PROJECT_ID, gitBridgePort, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canServePushedFiles/state/" + PROJECT_ID), testprojDir.toPath()));
    runtime.exec("touch push.tex", null, testprojDir).waitFor();
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    gitPush(testprojDir);

    // With no key, we should get a 404.
    String url = "http://127.0.0.1:" + gitBridgePort + "/api/testproj/push.tex";
    Response response = asyncHttpClient().prepareGet(url).execute().get();
    assertEquals(404, response.getStatusCode());

    // With an invalid project and no key, we should get a 404.
    url = "http://127.0.0.1:" + gitBridgePort + "/api/notavalidproject/push.tex";
    response = asyncHttpClient().prepareGet(url).execute().get();
    assertEquals(404, response.getStatusCode());

    // With a bad key for a valid project, we should get a 404.
    url = "http://127.0.0.1:" + gitBridgePort + "/api/testproj/push.tex?key=notavalidkey";
    response = asyncHttpClient().prepareGet(url).execute().get();
    assertEquals(404, response.getStatusCode());

    // With a bad key for an invalid project, we should get a 404.
    url = "http://127.0.0.1:" + gitBridgePort + "/api/notavalidproject/push.tex?key=notavalidkey";
    response = asyncHttpClient().prepareGet(url).execute().get();
    assertEquals(404, response.getStatusCode());
  }

  @Test
  public void wlgbCanSwapProjects() throws IOException, GitAPIException, InterruptedException {
    server = new MockSnapshotServer(3874, getResource("/wlgbCanSwapProjects").toFile());
    server.start();
    server.setState(states.get("wlgbCanSwapProjects").get("state"));
    wlgb =
        new GitBridgeApp(
            new String[] {
              makeConfigFile(33874, 3874, new SwapJobConfig(1, 0, 0, 250, null, true))
            });
    wlgb.run();
    File rootGitDir = new File(wlgb.config.getRootGitDirectory());
    File testProj1ServerDir = new File(rootGitDir, PROJECT_ID1);
    File testProj2ServerDir = new File(rootGitDir, PROJECT_ID2);
    File testProj1Dir = gitClone(PROJECT_ID1, 33874, dir);
    assertTrue(testProj1ServerDir.exists());
    assertFalse(testProj2ServerDir.exists());
    gitClone(PROJECT_ID2, 33874, dir);
    while (testProj1ServerDir.exists())
      ;
    assertFalse(testProj1ServerDir.exists());
    assertTrue(testProj2ServerDir.exists());
    FileUtils.deleteDirectory(testProj1Dir);
    gitClone(PROJECT_ID1, 33874, dir);
    while (testProj2ServerDir.exists())
      ;
    assertTrue(testProj1ServerDir.exists());
    assertFalse(testProj2ServerDir.exists());
  }

  private static final List<String> EXPECTED_OUT_PUSH_SUBMODULE =
      Arrays.asList(
          "remote: hint: Your Git repository contains a reference we cannot resolve.",
          "remote: hint: If your project contains a Git submodule,",
          "remote: hint: please remove it and try again.",
          "To http://127.0.0.1:33875/" + PROJECT_ID,
          "! [remote rejected] master -> master (invalid git repo)",
          "error: failed to push some refs to 'http://127.0.0.1:33875/" + PROJECT_ID + "'");

  @Test
  public void pushSubmoduleFailsWithInvalidGitRepo()
      throws IOException, GitAPIException, InterruptedException {
    server =
        new MockSnapshotServer(3875, getResource("/pushSubmoduleFailsWithInvalidGitRepo").toFile());
    server.start();
    server.setState(states.get("pushSubmoduleFailsWithInvalidGitRepo").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(33875, 3875)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, 33875, dir);
    runtime.exec("mkdir sub", null, testprojDir).waitFor();
    File sub = new File(testprojDir, "sub");
    runtime.exec("touch sub.txt", null, sub).waitFor();
    gitInit(sub);
    gitAdd(sub);
    gitCommit(sub, "sub");
    gitAdd(testprojDir);
    gitCommit(testprojDir, "push");
    Process push = gitPush(testprojDir, 1);
    List<String> actual = Util.linesFromStream(push.getErrorStream(), 2, "[K");
    assertEquals(EXPECTED_OUT_PUSH_SUBMODULE, actual);
  }

  @Test
  public void usesCustomErrorHandler()
      throws IOException, ExecutionException, InterruptedException {

    int gitBridgePort = 33873;
    int mockServerPort = 3873;

    server = new MockSnapshotServer(mockServerPort, getResource("/canServePushedFiles").toFile());
    server.start();
    server.setState(states.get("canServePushedFiles").get("state"));

    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();

    // With an invalid project and no key, we should get a 404,
    // which is rendered by our custom error handler.
    String url = "http://127.0.0.1:" + gitBridgePort + "/api/notavalidproject/main.tex";
    Response response = asyncHttpClient().prepareGet(url).execute().get();
    assertEquals(404, response.getStatusCode());
    assertEquals("{\"message\":\"HTTP error 404\"}", response.getResponseBody());

    // With an unsupported URL outside the api, the request is assumed to
    // be from a git client and we should get a 401 because the request
    // does not include basic auth credentials.
    url = "http://127.0.0.1:" + gitBridgePort + "/foo";
    response = asyncHttpClient().prepareGet(url).execute().get();
    assertEquals(401, response.getStatusCode());
  }

  @Test
  public void cannotCloneAProtectedProjectWithoutAuthentication()
      throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33883;
    int mockServerPort = 3883;

    server =
        new MockSnapshotServer(
            mockServerPort,
            getResource("/cannotCloneAProtectedProjectWithoutAuthentication").toFile());
    server.start();
    server.setState(states.get("cannotCloneAProtectedProjectWithoutAuthentication").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});

    wlgb.run();
    Process gitProcess =
        runtime.exec(
            "git clone http://git:password@127.0.0.1:" + gitBridgePort + "/" + PROJECT_ID,
            null,
            dir);
    assertNotEquals(0, gitProcess.waitFor());
  }

  @Test
  public void cannotCloneA4xxProject() throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33879;
    int mockServerPort = 3879;

    server =
        new MockSnapshotServer(mockServerPort, getResource("/cannotCloneA4xxProject").toFile());
    server.start();
    server.setState(states.get("cannotCloneA4xxProject").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});

    wlgb.run();
    Process gitProcess =
        runtime.exec(
            "git clone http://git:password@127.0.0.1:" + gitBridgePort + "/" + PROJECT_ID,
            null,
            dir);
    assertNotEquals(0, gitProcess.waitFor());
  }

  @Test
  public void cannotCloneAMissingProject()
      throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33880;
    int mockServerPort = 3880;

    server =
        new MockSnapshotServer(mockServerPort, getResource("/cannotCloneAMissingProject").toFile());
    server.start();
    server.setState(states.get("cannotCloneAMissingProject").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});

    wlgb.run();
    Process gitProcess =
        runtime.exec(
            "git clone http://git:password@127.0.0.1:" + gitBridgePort + "/" + PROJECT_ID,
            null,
            dir);
    assertNotEquals(0, gitProcess.waitFor());
  }

  @Test
  public void canMigrateRepository() throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33881;
    int mockServerPort = 3881;
    server = new MockSnapshotServer(mockServerPort, getResource("/canMigrateRepository").toFile());
    server.start();
    server.setState(states.get("canMigrateRepository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, gitBridgePort, dir);
    File testprojDir2 = gitClone(PROJECT_ID2, gitBridgePort, dir);
    // Second project content is equal to content of the first
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canMigrateRepository/state/" + PROJECT_ID), testprojDir2.toPath()));
  }

  @Test
  public void skipMigrationWhenMigratedFromMissing()
      throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33882;
    int mockServerPort = 3882;
    server =
        new MockSnapshotServer(
            mockServerPort, getResource("/skipMigrationWhenMigratedFromMissing").toFile());
    server.start();
    server.setState(states.get("skipMigrationWhenMigratedFromMissing").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    // don't clone the source project first
    File testprojDir2 = gitClone(PROJECT_ID2, gitBridgePort, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/skipMigrationWhenMigratedFromMissing/state/" + PROJECT_ID2),
            testprojDir2.toPath()));
  }

  @Test
  public void canCloneAMigratedRepositoryWithoutChanges()
      throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33883;
    int mockServerPort = 3883;
    server =
        new MockSnapshotServer(
            mockServerPort, getResource("/canCloneAMigratedRepositoryWithoutChanges").toFile());
    server.start();
    server.setState(states.get("canCloneAMigratedRepositoryWithoutChanges").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    File testprojDir = gitClone(PROJECT_ID, gitBridgePort, dir);
    assertTrue(
        FileUtil.gitDirectoriesAreEqual(
            getResource("/canCloneAMigratedRepositoryWithoutChanges/state/" + PROJECT_ID),
            testprojDir.toPath()));
  }

  @Test
  public void rejectV1Repository() throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33884;
    int mockServerPort = 3884;
    server = new MockSnapshotServer(mockServerPort, getResource("/rejectV1Repository").toFile());
    server.start();
    server.setState(states.get("rejectV1Repository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    Process gitProcess =
        runtime.exec(
            "git clone http://git:password@127.0.0.1:" + gitBridgePort + "/1234bbccddff.git",
            null,
            dir);
    assertNotEquals(0, gitProcess.waitFor());
  }

  @Test
  public void cannotCloneAHasDotGitProject()
      throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33885;
    int mockServerPort = 3885;

    server =
        new MockSnapshotServer(
            mockServerPort, getResource("/cannotCloneAHasDotGitProject").toFile());
    server.start();
    server.setState(states.get("cannotCloneAHasDotGitProject").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});

    wlgb.run();
    Process gitProcess =
        runtime.exec(
            "git clone http://git:password@127.0.0.1:" + gitBridgePort + "/conflict.git",
            null,
            dir);
    assertNotEquals(0, gitProcess.waitFor());
    wlgb.stop();
  }

  @Test
  public void cannotCloneProjectWithSlash()
      throws IOException, GitAPIException, InterruptedException {
    int gitBridgePort = 33886;
    int mockServerPort = 3886;

    server = new MockSnapshotServer(mockServerPort, getResource("/canCloneARepository").toFile());
    server.start();
    server.setState(states.get("canCloneARepository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});

    wlgb.run();
    Process gitProcess =
        runtime.exec(
            "git clone http://git:password@127.0.0.1:" + gitBridgePort + "/project/1234abcd",
            null,
            dir);
    assertNotEquals(0, gitProcess.waitFor());

    List<String> actual = Util.linesFromStream(gitProcess.getErrorStream(), 0, "");
    assertEquals(
        Arrays.asList(
            "Cloning into '1234abcd'...",
            "remote: Invalid Project ID (must not have a '/project' prefix)",
            "fatal: repository 'http://127.0.0.1:33886/project/1234abcd/' not found"),
        actual);

    wlgb.stop();
  }

  @Test
  public void testStatusAndHealthCheckEndpoints() throws ClientProtocolException, IOException {
    int gitBridgePort = 33887;
    int mockServerPort = 3887;
    server = new MockSnapshotServer(mockServerPort, getResource("/canCloneARepository").toFile());
    server.start();
    server.setState(states.get("canCloneARepository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    HttpClient client = HttpClients.createDefault();
    String urlBase = "http://127.0.0.1:" + gitBridgePort;
    // Status
    HttpGet statusRequest = new HttpGet(urlBase + "/status");
    HttpResponse statusResponse = client.execute(statusRequest);
    assertEquals(200, statusResponse.getStatusLine().getStatusCode());
    // Health Check
    HttpGet healthCheckRequest = new HttpGet(urlBase + "/health_check");
    HttpResponse healthCheckResponse = client.execute(healthCheckRequest);
    assertEquals(200, healthCheckResponse.getStatusLine().getStatusCode());
  }

  @Test
  public void testStatusAndHealthCheckEndpointsWithTrailingSlash()
      throws ClientProtocolException, IOException {
    int gitBridgePort = 33888;
    int mockServerPort = 3888;
    server = new MockSnapshotServer(mockServerPort, getResource("/canCloneARepository").toFile());
    server.start();
    server.setState(states.get("canCloneARepository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    HttpClient client = HttpClients.createDefault();
    String urlBase = "http://127.0.0.1:" + gitBridgePort;
    // Status
    HttpGet statusRequest = new HttpGet(urlBase + "/status/");
    HttpResponse statusResponse = client.execute(statusRequest);
    assertEquals(200, statusResponse.getStatusLine().getStatusCode());
    // Health Check
    HttpGet healthCheckRequest = new HttpGet(urlBase + "/health_check/");
    HttpResponse healthCheckResponse = client.execute(healthCheckRequest);
    assertEquals(200, healthCheckResponse.getStatusLine().getStatusCode());
  }

  @Test
  public void testStatusAndHealthCheckEndpointsWithHead()
      throws ClientProtocolException, IOException {
    int gitBridgePort = 33889;
    int mockServerPort = 3889;
    server = new MockSnapshotServer(mockServerPort, getResource("/canCloneARepository").toFile());
    server.start();
    server.setState(states.get("canCloneARepository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    HttpClient client = HttpClients.createDefault();
    String urlBase = "http://127.0.0.1:" + gitBridgePort;
    // Status
    HttpHead statusRequest = new HttpHead(urlBase + "/status");
    HttpResponse statusResponse = client.execute(statusRequest);
    assertEquals(200, statusResponse.getStatusLine().getStatusCode());
    // Health Check
    HttpHead healthCheckRequest = new HttpHead(urlBase + "/health_check");
    HttpResponse healthCheckResponse = client.execute(healthCheckRequest);
    assertEquals(200, healthCheckResponse.getStatusLine().getStatusCode());
  }

  @Test
  public void gitLfsBatchEndpoint() throws ClientProtocolException, IOException, ParseException {
    int gitBridgePort = 33890;
    int mockServerPort = 3890;
    server = new MockSnapshotServer(mockServerPort, getResource("/canCloneARepository").toFile());
    server.start();
    server.setState(states.get("canCloneARepository").get("state"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    HttpClient client = HttpClients.createDefault();
    String urlBase = "http://git:password@127.0.0.1:" + gitBridgePort;
    HttpPost gitLfsRequest =
        new HttpPost(urlBase + "/5f2419407929eb0026641967.git/info/lfs/objects/batch");
    HttpResponse gitLfsResponse = client.execute(gitLfsRequest);
    assertEquals(422, gitLfsResponse.getStatusLine().getStatusCode());
    HttpEntity entity = gitLfsResponse.getEntity();
    String responseString = EntityUtils.toString(entity, "UTF-8");
    assertTrue(responseString.contains("Git LFS is not supported on Overleaf"));
  }

  @Test
  public void canPullIgnoredForceAddedFile() throws IOException, InterruptedException {
    int gitBridgePort = 33891;
    int mockServerPort = 3891;
    server =
        new MockSnapshotServer(
            mockServerPort, getResource("/canPullIgnoredForceAddedFile").toFile());
    server.start();
    server.setState(states.get("canPullIgnoredForceAddedFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    File testProjDir = gitClone(PROJECT_ID, gitBridgePort, dir);
    File one = new File(testProjDir, "sub/one.txt");
    one.createNewFile();
    FileWriter fw = new FileWriter(one.getPath());
    fw.write("1");
    fw.close();
    assertEquals(0, runtime.exec("git add -A -f", null, testProjDir).waitFor());
    gitCommit(testProjDir, "push");
    gitPush(testProjDir);
    server.setState(states.get("canPullIgnoredForceAddedFile").get("withUpdatedMainFile"));
    gitPull(testProjDir);
    File f = new File(testProjDir.getPath() + "/sub/one.txt");
    assertTrue(f.exists());
  }

  @Test
  public void canPullIgnoredFileFromOverleaf() throws IOException, InterruptedException {
    int gitBridgePort = 33892;
    int mockServerPort = 3892;
    server =
        new MockSnapshotServer(
            mockServerPort, getResource("/canPullIgnoredForceAddedFile").toFile());
    server.start();
    server.setState(states.get("canPullIgnoredForceAddedFile").get("base"));
    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();
    File testProjDir = gitClone(PROJECT_ID, gitBridgePort, dir);
    server.setState(states.get("canPullIgnoredForceAddedFile").get("withUpdatedMainFile"));
    gitPull(testProjDir);
    File f = new File(testProjDir.getPath() + "/sub/one.txt");
    assertTrue(f.exists());
  }

  @Test
  public void noCors() throws IOException, ExecutionException, InterruptedException {

    int gitBridgePort = 33893;
    int mockServerPort = 3893;

    server = new MockSnapshotServer(mockServerPort, getResource("/canServePushedFiles").toFile());
    server.start();
    server.setState(states.get("canServePushedFiles").get("state"));

    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();

    String url = "http://127.0.0.1:" + gitBridgePort + "/status";
    Response response = asyncHttpClient().prepareGet(url).execute().get();
    assertEquals(200, response.getStatusCode());
    assertEquals("ok\n", response.getResponseBody());
    assertNull(response.getHeader("Access-Control-Allow-Origin"));
  }

  @Test
  public void cors() throws IOException, ExecutionException, InterruptedException {

    int gitBridgePort = 33894;
    int mockServerPort = 3894;

    server = new MockSnapshotServer(mockServerPort, getResource("/canServePushedFiles").toFile());
    server.start();
    server.setState(states.get("canServePushedFiles").get("state"));

    wlgb = new GitBridgeApp(new String[] {makeConfigFile(gitBridgePort, mockServerPort)});
    wlgb.run();

    String url = "http://127.0.0.1:" + gitBridgePort + "/status";

    // Success
    Response response =
        asyncHttpClient()
            .prepareOptions(url)
            .setHeader("Origin", "https://localhost")
            .execute()
            .get();
    assertEquals(200, response.getStatusCode());
    assertEquals("", response.getResponseBody());
    assertEquals("https://localhost", response.getHeader("Access-Control-Allow-Origin"));

    response =
        asyncHttpClient().prepareGet(url).setHeader("Origin", "https://localhost").execute().get();
    assertEquals(200, response.getStatusCode());
    assertEquals("ok\n", response.getResponseBody());
    assertEquals("https://localhost", response.getHeader("Access-Control-Allow-Origin"));

    // Deny
    response =
        asyncHttpClient()
            .prepareOptions(url)
            .setHeader("Origin", "https://not-localhost")
            .execute()
            .get();
    assertEquals(403, response.getStatusCode());
    assertEquals("", response.getResponseBody());
    assertNull(response.getHeader("Access-Control-Allow-Origin"));

    response =
        asyncHttpClient()
            .prepareGet(url)
            .setHeader("Origin", "https://not-localhost")
            .execute()
            .get();
    assertEquals(200, response.getStatusCode());
    assertEquals("ok\n", response.getResponseBody());
    assertNull(response.getHeader("Access-Control-Allow-Origin"));
  }

  private String makeConfigFile(int port, int apiPort) throws IOException {
    return makeConfigFile(port, apiPort, null);
  }

  private String makeConfigFile(int port, int apiPort, SwapJobConfig swapCfg) throws IOException {
    File wlgb = folder.newFolder();
    File config = folder.newFile();
    PrintWriter writer = new PrintWriter(config);
    String cfgStr =
        "{\n"
            + "    \"port\": "
            + port
            + ",\n"
            + "    \"bindIp\": \"127.0.0.1\",\n"
            + "    \"idleTimeout\": 30000,\n"
            + "    \"rootGitDirectory\": \""
            + wlgb.getAbsolutePath()
            + "\",\n"
            + "    \"allowedCorsOrigins\": \"https://localhost\",\n"
            + "    \"apiBaseUrl\": \"http://127.0.0.1:"
            + apiPort
            + "/api/v0\",\n"
            + "    \"postbackBaseUrl\": \"http://127.0.0.1:"
            + port
            + "\",\n"
            + "    \"serviceName\": \"Overleaf\",\n"
            + "    \"oauth2Server\": \"http://127.0.0.1:"
            + apiPort
            + "\"";
    if (swapCfg != null) {
      cfgStr +=
          ",\n"
              + "    \"swapStore\": {\n"
              + "        \"type\": \"memory\",\n"
              + "        \"awsAccessKey\": null,\n"
              + "        \"awsSecret\": null,\n"
              + "        \"s3BucketName\": \"com.overleaf.testbucket\"\n"
              + "    },\n"
              + "    \"swapJob\": {\n"
              + "        \"allowUnsafeStores\": true,"
              + "        \"minProjects\": "
              + swapCfg.getMinProjects()
              + ",\n"
              + "        \"lowGiB\": "
              + swapCfg.getLowGiB()
              + ",\n"
              + "        \"highGiB\": "
              + swapCfg.getHighGiB()
              + ",\n"
              + "        \"intervalMillis\": "
              + swapCfg.getIntervalMillis()
              + "    }\n";
    }
    cfgStr += "}\n";
    writer.print(cfgStr);
    writer.close();
    return config.getAbsolutePath();
  }

  private Path getResource(String path) {
    return Paths.get(
        "src/test/resources/" + "uk/ac/ic/wlgitbridge/WLGitBridgeIntegrationTest" + path);
  }

  private InputStream getResourceAsStream(String path) {
    try {
      return new FileInputStream(getResource(path).toFile());
    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    }
  }

  private static String withoutWhitespace(String s) {
    return s.replaceAll("\\s", "");
  }
}
