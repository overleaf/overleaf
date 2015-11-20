package uk.ac.ic.wlgitbridge.data.model;

import static org.junit.Assert.*;
import static org.junit.Assert.assertEquals;
import static org.mockserver.model.HttpRequest.request;
import static org.mockserver.model.HttpResponse.response;

import org.eclipse.jgit.lib.*;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.mockserver.client.server.MockServerClient;
import org.mockserver.junit.MockServerRule;
import uk.ac.ic.wlgitbridge.data.model.db.PersistentStore;


import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Created by m on 20/11/15.
 */
public class ResourceFetcherTest {
    @Rule
    public MockServerRule mockServerRule = new MockServerRule(this);

    private MockServerClient mockServerClient;

    @Test
    public void fetchesFilesThatAreMissingFromUrlStoreCache() throws IOException {
        final String testProjectName = "123abc";
        final String testUrl = "http://localhost:" + mockServerRule.getHttpPort() + "/123abc";

        mockServerClient.when(
            request()
            .withMethod("GET")
            .withPath("/123abc")
        )
        .respond(
            response()
            .withStatusCode(200)
            .withBody("content")
        );

        final PersistentStore persistentStore = new PersistentStore() {
            @Override
            public List<String> getProjectNames() {
                return null;
            }

            @Override
            public void setLatestVersionForProject(String project, int versionID) {

            }

            @Override
            public int getLatestVersionForProject(String project) {
                return 0;
            }

            @Override
            public void addURLIndexForProject(String projectName, String url, String path) {

            }

            @Override
            public void deleteFilesForProject(String project, String... files) {

            }

            @Override
            public String getPathForURLInProject(String projectName, String url) {
                assertEquals(testProjectName, projectName);
                assertEquals(testUrl, url);
                return "missingPath";
            }
        };

        ResourceFetcher resourceFetcher = new ResourceFetcher(persistentStore);
        TemporaryFolder repositoryFolder = new TemporaryFolder();
        repositoryFolder.create();
        Repository repository = new FileRepositoryBuilder().setWorkTree(repositoryFolder.getRoot()).build();
        Map<String, byte[]> fetchedUrls = new HashMap<String, byte[]>();
        resourceFetcher.get(testProjectName, testUrl, "testPath", repository, fetchedUrls);
                //     public RawFile get(String projectName, String url, String newPath, Repository repository, Map<String, byte[]> fetchedUrls) throws IOException {

    }
}