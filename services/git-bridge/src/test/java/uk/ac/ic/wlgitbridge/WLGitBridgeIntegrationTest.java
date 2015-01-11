package uk.ac.ic.wlgitbridge;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import uk.ac.ic.wlgitbridge.application.WLGitBridgeApplication;
import uk.ac.ic.wlgitbridge.test.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIState;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIStateBuilder;
import uk.ac.ic.wlgitbridge.test.util.FileUtil;

import java.io.*;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

import static org.junit.Assert.assertTrue;

/**
 * Created by Winston on 11/01/15.
 */
public class WLGitBridgeIntegrationTest {

    private MockSnapshotServer server;
    private Map<String, Map<String, SnapshotAPIState>> states =
            new HashMap<String, Map<String, SnapshotAPIState>>() {{
                put("canCloneARepository", new HashMap<String, SnapshotAPIState>() {{
                    put("state", new SnapshotAPIStateBuilder(getResourceAsStream("/canCloneARepository/state/state.json")).build());
                }});
            }};

    @Rule
    public TemporaryFolder folder = new TemporaryFolder();

    @Before
    public void startMockSnapshotAPIServer() throws URISyntaxException {
        server = new MockSnapshotServer(Paths.get(getClass().getResource("/uk/ac/ic/wlgitbridge/WLGitBridgeIntegrationTest/").toURI()).toFile());
        server.start();
    }

    @Test
    public void canCloneARepository() throws IOException, GitAPIException {
        server.setState(states.get("canCloneARepository").get("state"));
        WLGitBridgeApplication wlgb = new WLGitBridgeApplication(new String[] {
                makeConfigFile()
        });
        wlgb.run();
        folder.create();
        File git = folder.newFolder();
        Git.cloneRepository()
           .setURI("http://127.0.0.1:30080/testproj.git")
           .setDirectory(git)
           .call()
           .close();
        wlgb.stop();
        assertTrue(FileUtil.gitDirectoriesAreEqual(getResource("/canCloneARepository/state/git"), git.toPath()));
    }

    private String makeConfigFile() throws IOException {
        File wlgb = folder.newFolder();
        File config = folder.newFile();
        PrintWriter writer = new PrintWriter(config);
        writer.println("{\n" +
                "\t\"port\": 30080,\n" +
                "\t\"rootGitDirectory\": \"" + wlgb.getAbsolutePath() + "\",\n" +
                "\t\"apiBaseUrl\": \"http://127.0.0.1:60000/api/v0\",\n" +
                "\t\"username\": \"\",\n" +
                "\t\"password\": \"\",\n" +
                "\t\"postbackBaseUrl\": \"http://127.0.0.1:30080\",\n" +
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
