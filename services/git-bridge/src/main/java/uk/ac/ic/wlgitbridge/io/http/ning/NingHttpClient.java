package uk.ac.ic.wlgitbridge.io.http.ning;

import io.netty.handler.codec.http.HttpHeaders;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import org.asynchttpclient.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uk.ac.ic.wlgitbridge.util.FunctionT;

public class NingHttpClient implements NingHttpClientFacade {

  private static final Logger log = LoggerFactory.getLogger(NingHttpClient.class);

  private final AsyncHttpClient http;

  public NingHttpClient(AsyncHttpClient http) {
    this.http = http;
  }

  @Override
  public <E extends Exception> byte[] get(String url, FunctionT<HttpHeaders, Boolean, E> handler)
      throws ExecutionException {
    try {
      return http.prepareGet(url)
          .execute(
              new AsyncCompletionHandler<byte[]>() {

                ByteArrayOutputStream bytes = new ByteArrayOutputStream();

                @Override
                public State onHeadersReceived(HttpHeaders headers) throws E {
                  return handler.apply(headers) ? State.CONTINUE : State.ABORT;
                }

                @Override
                public State onBodyPartReceived(HttpResponseBodyPart content) throws IOException {
                  bytes.write(content.getBodyPartBytes());
                  return State.CONTINUE;
                }

                @Override
                public byte[] onCompleted(Response response) throws Exception {
                  int statusCode = response.getStatusCode();
                  if (statusCode >= 400) {
                    throw new Exception("got status " + statusCode + " fetching " + url);
                  }
                  byte[] ret = bytes.toByteArray();
                  bytes.close();
                  log.debug(
                      statusCode
                          + " "
                          + response.getStatusText()
                          + " ("
                          + ret.length
                          + "B) -> "
                          + url);
                  return ret;
                }
              })
          .get();
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    }
  }
}
