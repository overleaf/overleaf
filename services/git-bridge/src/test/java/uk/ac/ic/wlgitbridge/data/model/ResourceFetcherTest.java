package uk.ac.ic.wlgitbridge.data.model;

import static org.junit.Assert.*;
import static org.junit.Assert.assertEquals;
import static org.mockserver.model.HttpRequest.request;
import static org.mockserver.model.HttpResponse.response;

import org.eclipse.jgit.lib.*;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.jmock.Expectations;
import org.jmock.Mockery;
import org.hamcrest.TypeSafeMatcher;
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
        final String oldTestPath = "testPath";
        final String newTestPath = "missingPath";

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

        final Mockery context = new Mockery();
        final PersistentStore persistentStore = context.mock(PersistentStore.class);
        context.checking(new Expectations() {{
            // It should fetch the file once it finds it is missing.
            oneOf(persistentStore).getPathForURLInProject(testProjectName, testUrl);
            will(returnValue(oldTestPath));

            // It should update the URL index store once it has fetched; at present, it does not actually change the stored path.
            oneOf(persistentStore).addURLIndexForProject(testProjectName, testUrl, oldTestPath);
        }});

        ResourceFetcher resourceFetcher = new ResourceFetcher(persistentStore);
        TemporaryFolder repositoryFolder = new TemporaryFolder();
        repositoryFolder.create();
        Repository repository = new FileRepositoryBuilder().setWorkTree(repositoryFolder.getRoot()).build();
        Map<String, byte[]> fetchedUrls = new HashMap<String, byte[]>();
        resourceFetcher.get(testProjectName, testUrl, newTestPath, repository, fetchedUrls);

        // We don't bother caching in this case, at present.
        assertEquals(0, fetchedUrls.size());
    }
}