package uk.ac.ic.wlgitbridge.snapshot.servermock.server;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.ning.http.client.AsyncHttpClient;
import uk.ac.ic.wlgitbridge.util.Log;

import java.io.IOException;
import java.io.Reader;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 10/01/15.
 */
public class PostbackThread extends Thread {

    private String url;
    private String postback;

    public PostbackThread(Reader reader, String postback) {
        if (postback != null) {
            url = new Gson().fromJson(
                    reader,
                    JsonObject.class
            ).get("postbackUrl").getAsString();
            this.postback = postback;
        }
    }

    @Override
    public void run() {
        try {
            new AsyncHttpClient().preparePost(
                    url
            ).setBody(postback).execute().get().getResponseBody();
        } catch (IOException e) {
            Log.warn(
                    "IOException on postback, url: " +
                            url +
                            ", postback: " +
                            postback,
                    e
            );
        } catch (InterruptedException e) {
            Log.warn(
                    "Interrupted on postback, url: " +
                            url +
                            ", postback: " +
                            postback,
                    e
            );
        } catch (ExecutionException e) {
            Log.warn(
                    "ExecutionException on postback, url: " +
                            url +
                            ", postback: " +
                            postback,
                    e
            );
        }
    }

    public void startIfNotNull() {
        if (url != null && postback != null) {
            start();
        }
    }

}
