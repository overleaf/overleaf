package uk.ac.ic.wlgitbridge;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.api.errors.TransportException;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.application.WLGitBridgeApplication;
import uk.ac.ic.wlgitbridge.test.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIState;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIStateBuilder;
import uk.ac.ic.wlgitbridge.test.util.FileUtil;

import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/**
 * Created by Winston on 11/01/15.
 */
public class WLGitBridgeIntegrationTest {

    private Map<String, Map<String, SnapshotAPIState>> states =
            new HashMap<String, Map<String, SnapshotAPIState>>() {{
                put("canCloneARepository", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/canCloneARepository/state/state.json")).build());
                }});
                put("canCloneMultipleRepositories", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/canCloneMultipleRepositories/state/state.json")).build());
                }});
                put("canPullADeletedTexFile", new HashMap<String, SnapshotAPIState>() {{
                    put("base", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedTexFile/base/state.json")).build());
                    put("withDeletedTexFile", new SnapshotAPIStateBuilder(getResourceAsStream("/canPullADeletedTexFile/withDeletedTexFile/state.json")).build());
                }});
                put("cannotCloneAProtectedProject", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/cannotCloneAProtectedProject/state/state.json")).build());
                }});
            }};

    @Rule
    public TemporaryFolder folder = new TemporaryFolder();

    @Test
    public void canCloneARepository() throws IOException, GitAPIException {
        MockSnapshotServer server = new MockSnapshotServer(3857, getResource("/canCloneARepository").toFile());
        server.start();
        server.setState(states.get("canCloneARepository").get("state"));
        WLGitBridgeApplication wlgb = new WLGitBridgeApplication(new String[] {
                makeConfigFile(33857, 3857)
        });
        wlgb.run();
        folder.create();
        File git = folder.newFolder();
        Git.cloneRepository()
           .setURI("http://127.0.0.1:33857/testproj.git")
           .setDirectory(git)
           .call()
           .close();
        wlgb.stop();
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canCloneARepository/state/testproj"), git.toPath()));
    }

    @Test
    public void canCloneMultipleRepositories() throws IOException, GitAPIException {
        MockSnapshotServer server = new MockSnapshotServer(3858, getResource("/canCloneMultipleRepositories").toFile());
        server.start();
        server.setState(states.get("canCloneMultipleRepositories").get("state"));
        WLGitBridgeApplication wlgb = new WLGitBridgeApplication(new String[] {
                makeConfigFile(33858, 3858)
        });
        wlgb.run();
        folder.create();
        File testproj1 = folder.newFolder();
        Git.cloneRepository()
                .setURI("http://127.0.0.1:33858/testproj1.git")
                .setDirectory(testproj1)
                .call()
                .close();
        File testproj2 = folder.newFolder();
        Git.cloneRepository()
                .setURI("http://127.0.0.1:33858/testproj2.git")
                .setDirectory(testproj2)
                .call()
                .close();
        wlgb.stop();
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canCloneMultipleRepositories/state/testproj1"), testproj1.toPath()));
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canCloneMultipleRepositories/state/testproj2"), testproj2.toPath()));
    }

    @Test
    public void canPullADeletedTexFile() throws IOException, GitAPIException {
        MockSnapshotServer server = new MockSnapshotServer(3860, getResource("/canPullADeletedTexFile").toFile());
        server.start();
        server.setState(states.get("canPullADeletedTexFile").get("base"));
        WLGitBridgeApplication wlgb = new WLGitBridgeApplication(new String[] {
                makeConfigFile(33860, 3860)
        });
        wlgb.run();
        folder.create();
        File git = folder.newFolder();
        Git base = Git.cloneRepository()
                .setURI("http://127.0.0.1:33860/testproj.git")
                .setDirectory(git)
                .call();
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullADeletedTexFile/base/testproj"), git.toPath()));
        server.setState(states.get("canPullADeletedTexFile").get("withDeletedTexFile"));
        base.pull().call();
        base.close();
        wlgb.stop();
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canPullADeletedTexFile/withDeletedTexFile/testproj"), git.toPath()));
    }

    @Test
    public void cannotCloneAProtectedProject() throws IOException, GitAPIException {
        MockSnapshotServer server = new MockSnapshotServer(3861, getResource("/cannotCloneAProtectedProject").toFile());
        server.start();
        server.setState(states.get("cannotCloneAProtectedProject").get("state"));
        WLGitBridgeApplication wlgb = new WLGitBridgeApplication(new String[] {
                makeConfigFile(33861, 3861)
        });
        wlgb.run();
        folder.create();
        File git = folder.newFolder();
        try {
            Git.cloneRepository()
                    .setURI("http://127.0.0.1:33861/protected.git")
                    .setDirectory(git)
                    .call()
                    .close();
        } catch (TransportException e) {
            assertEquals("http://127.0.0.1:33861/protected.git: Your project is protected, and can't be cloned (yet).", e.getMessage());
            return;
        } finally {
            wlgb.stop();
        }
        fail();
    }

    private String makeConfigFile(int port, int apiPort) throws IOException {
        File wlgb = folder.newFolder();
        File config = folder.newFile();
        PrintWriter writer = new PrintWriter(config);
        writer.println("{\n" +
                "\t\"port\": " + port + ",\n" +
                "\t\"rootGitDirectory\": \"" + wlgb.getAbsolutePath() + "\",\n" +
                "\t\"apiBaseUrl\": \"http://127.0.0.1:" + apiPort + "/api/v0\",\n" +
                "\t\"username\": \"\",\n" +
                "\t\"password\": \"\",\n" +
                "\t\"postbackBaseUrl\": \"http://127.0.0.1:" + port + "\",\n" +
                "\t\"serviceName\": \"Overleaf\"\n" +
                "}\n");
        writer.close();
        return config.getAbsolutePath();
    }

    private Path getResource(String path) {
        return Paths.get("src/test/resources/uk/ac/ic/wlgitbridge/WLGitBridgeIntegrationTest" + path);
    }

    private InputStream getResourceAsStream(String path) {
        try {
            return new FileInputStream(getResource(path).toFile());
        } catch (FileNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

}
