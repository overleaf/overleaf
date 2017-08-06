package uk.ac.ic.wlgitbridge.io.http.ning;

import com.ning.http.client.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uk.ac.ic.wlgitbridge.util.FunctionT;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.function.Function;

public class NingHttpClient implements NingHttpClientFacade {

    private static final Logger log
            = LoggerFactory.getLogger(NingHttpClient.class);

    private final AsyncHttpClient http;

    public NingHttpClient(AsyncHttpClient http) {
        this.http = http;
    }

    @Override
    public <E extends Exception> byte[] get(
            String url,
            FunctionT<HttpResponseHeaders, Boolean, E> handler
    ) throws E {
        try {
            return http
                    .prepareGet(url)
                    .execute(new AsyncCompletionHandler<byte[]>() {

                ByteArrayOutputStream bytes = new ByteArrayOutputStream();

                @Override
                public STATE onHeadersReceived(
                        HttpResponseHeaders headers
                ) throws E {
                    return handler.apply(headers)
                            ? STATE.CONTINUE : STATE.ABORT;
                }

                @Override
                public STATE onBodyPartReceived(
                        HttpResponseBodyPart content
                ) throws IOException {
                    bytes.write(content.getBodyPartBytes());
                    return STATE.CONTINUE;
                }

                @Override
                public byte[] onCompleted(
                        Response response
                ) throws IOException {
                    byte[] ret = bytes.toByteArray();
                    bytes.close();
                    log.info(
                            response.getStatusCode()
                                    + " "
                                    + response.getStatusText()
                                    + " ("
                                    + ret.length
                                    + "B) -> "
                                    + url
                    );
                    return ret;
                }

            }).get();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        } catch (ExecutionException e) {
            try {
                /* No clean way to do this */
                //noinspection unchecked
                throw (E) e.getCause();
            } catch (ClassCastException cce) {
                throw new RuntimeException(cce);
            }
        }
    }

}
