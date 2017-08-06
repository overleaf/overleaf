package uk.ac.ic.wlgitbridge.io.http.ning;

import com.ning.http.client.HttpResponseHeaders;
import uk.ac.ic.wlgitbridge.util.FunctionT;

import java.util.concurrent.ExecutionException;
import java.util.function.Function;

public interface NingHttpClientFacade {

    /**
     * Performs a GET request
     * @param url the target URL
     * @param handler handler for the response headers. Returning false
     *                aborts the request.
     * @return
     */
    <E extends Exception> byte[] get(
            String url,
            FunctionT<HttpResponseHeaders, Boolean, E> handler
    ) throws E;

}
