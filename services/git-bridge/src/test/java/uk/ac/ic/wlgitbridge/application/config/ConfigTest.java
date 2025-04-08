package uk.ac.ic.wlgitbridge.application.config;

import static org.junit.Assert.*;

import java.io.Reader;
import java.io.StringReader;
import org.junit.Test;

/*
 * Created by winston on 25/10/15.
 */
public class ConfigTest {

  @Test
  public void testConstructWithOauth() {
    Reader reader =
        new StringReader(
            "{\n"
                + "    \"port\": 80,\n"
                + "    \"bindIp\": \"127.0.0.1\",\n"
                + "    \"idleTimeout\": 30000,\n"
                + "    \"rootGitDirectory\": \"/var/wlgb/git\",\n"
                + "    \"apiBaseUrl\": \"http://127.0.0.1:60000/api/v0\",\n"
                + "    \"postbackBaseUrl\": \"http://127.0.0.1\",\n"
                + "    \"serviceName\": \"Overleaf\",\n"
                + "    \"oauth2Server\": \"https://www.overleaf.com\"\n"
                + "}\n");
    Config config = new Config(reader);
    assertEquals(80, config.getPort());
    assertEquals("/var/wlgb/git", config.getRootGitDirectory());
    assertEquals("http://127.0.0.1:60000/api/v0/", config.getAPIBaseURL());
    assertEquals("http://127.0.0.1/", config.getPostbackURL());
    assertEquals("Overleaf", config.getServiceName());
    assertEquals("https://www.overleaf.com", config.getOauth2Server());
  }

  @Test(expected = AssertionError.class)
  public void testConstructWithoutOauth() {
    Reader reader =
        new StringReader(
            "{\n"
                + "    \"port\": 80,\n"
                + "    \"bindIp\": \"127.0.0.1\",\n"
                + "    \"idleTimeout\": 30000,\n"
                + "    \"rootGitDirectory\": \"/var/wlgb/git\",\n"
                + "    \"apiBaseUrl\": \"http://127.0.0.1:60000/api/v0\",\n"
                + "    \"postbackBaseUrl\": \"http://127.0.0.1\",\n"
                + "    \"serviceName\": \"Overleaf\",\n"
                + "    \"oauth2Server\": null\n"
                + "}\n");
    Config config = new Config(reader);
    assertEquals(80, config.getPort());
    assertEquals("/var/wlgb/git", config.getRootGitDirectory());
    assertEquals("http://127.0.0.1:60000/api/v0/", config.getAPIBaseURL());
    assertEquals("http://127.0.0.1/", config.getPostbackURL());
    assertEquals("Overleaf", config.getServiceName());
    assertNull(config.getOauth2Server());
  }

  @Test
  public void asSanitised() throws Exception {
    Reader reader =
        new StringReader(
            "{\n"
                + "    \"port\": 80,\n"
                + "    \"bindIp\": \"127.0.0.1\",\n"
                + "    \"idleTimeout\": 30000,\n"
                + "    \"rootGitDirectory\": \"/var/wlgb/git\",\n"
                + "    \"apiBaseUrl\": \"http://127.0.0.1:60000/api/v0\",\n"
                + "    \"postbackBaseUrl\": \"http://127.0.0.1\",\n"
                + "    \"serviceName\": \"Overleaf\",\n"
                + "    \"oauth2Server\": \"https://www.overleaf.com\"\n"
                + "}\n");
    Config config = new Config(reader);
    String expected =
        "{\n"
            + "  \"port\": 80,\n"
            + "  \"bindIp\": \"127.0.0.1\",\n"
            + "  \"idleTimeout\": 30000,\n"
            + "  \"rootGitDirectory\": \"/var/wlgb/git\",\n"
            + "  \"allowedCorsOrigins\": [],\n"
            + "  \"apiBaseURL\": \"http://127.0.0.1:60000/api/v0/\",\n"
            + "  \"postbackURL\": \"http://127.0.0.1/\",\n"
            + "  \"serviceName\": \"Overleaf\",\n"
            + "  \"oauth2Server\": \"https://www.overleaf.com\",\n"
            + "  \"userPasswordEnabled\": false,\n"
            + "  \"repoStore\": null,\n"
            + "  \"swapStore\": null,\n"
            + "  \"swapJob\": null,\n"
            + "  \"sqliteHeapLimitBytes\": 0\n"
            + "}";
    assertEquals(
        "sanitised config did not hide sensitive fields", expected, config.getSanitisedString());
  }
}
