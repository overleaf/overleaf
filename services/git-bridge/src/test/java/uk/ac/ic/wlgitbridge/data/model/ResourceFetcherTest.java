package uk.ac.ic.wlgitbridge.data.model;

import static org.junit.Assert.assertEquals;
import static org.mockserver.model.HttpRequest.request;
import static org.mockserver.model.HttpResponse.response;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.jmock.Expectations;
import org.jmock.Mockery;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.mockserver.client.MockServerClient;
import org.mockserver.junit.MockServerRule;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.repo.FSGitRepoStore;
import uk.ac.ic.wlgitbridge.bridge.repo.ProjectRepo;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.resource.ResourceCache;
import uk.ac.ic.wlgitbridge.bridge.resource.UrlResourceCache;
import uk.ac.ic.wlgitbridge.data.filestore.RawFile;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;

/*
 * Created by m on 20/11/15.
 */
public class ResourceFetcherTest {
  @Rule public MockServerRule mockServerRule = new MockServerRule(this);

  private MockServerClient mockServerClient;

  @Test
  public void fetchesFilesThatAreMissingFromUrlStoreCache() throws IOException, GitUserException {
    final String testProjectName = "123abc";
    final String testUrl = "http://localhost:" + mockServerRule.getPort() + "/123abc";
    final String oldTestPath = "testPath";
    final String newTestPath = "missingPath";

    mockServerClient
        .when(request().withMethod("GET").withPath("/123abc"))
        .respond(response().withStatusCode(200).withBody("content"));

    final Mockery context = new Mockery();
    final DBStore dbStore = context.mock(DBStore.class);
    context.checking(
        new Expectations() {
          {
            // It should fetch the file once it finds it is missing.
            oneOf(dbStore).getPathForURLInProject(testProjectName, testUrl);
            will(returnValue(oldTestPath));

            // It should update the URL index store once it has fetched; at present, it does not
            // actually change the stored path.
            oneOf(dbStore).addURLIndexForProject(testProjectName, testUrl, oldTestPath);
          }
        });

    ResourceCache resources = new UrlResourceCache(dbStore);
    TemporaryFolder repositoryFolder = new TemporaryFolder();
    repositoryFolder.create();
    String repoStorePath = repositoryFolder.getRoot().getAbsolutePath();
    RepoStore repoStore = new FSGitRepoStore(repoStorePath, Optional.empty());
    ProjectRepo repo = repoStore.initRepo("repo");
    Map<String, RawFile> fileTable = repo.getDirectory().getFileTable();
    Map<String, byte[]> fetchedUrls = new HashMap<>();
    resources.get(testProjectName, testUrl, newTestPath, fileTable, fetchedUrls, Optional.empty());

    // We don't bother caching in this case, at present.
    assertEquals(0, fetchedUrls.size());
  }
}
