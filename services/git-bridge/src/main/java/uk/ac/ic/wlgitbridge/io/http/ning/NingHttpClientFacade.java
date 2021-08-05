package uk.ac.ic.wlgitbridge.io.http.ning;

import io.netty.handler.codec.http.HttpHeaders;
import uk.ac.ic.wlgitbridge.util.FunctionT;

import java.util.concurrent.ExecutionException;

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
            FunctionT<HttpHeaders, Boolean, E> handler
    ) throws ExecutionException;

}
