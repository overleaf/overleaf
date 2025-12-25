package uk.ac.ic.wlgitbridge.snapshot.servermock.server;

import static org.asynchttpclient.Dsl.*;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.util.concurrent.ExecutionException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 10/01/15.
 */
public class PostbackThread extends Thread {

  private String url;
  private String postback;

  public PostbackThread(String requestBody, String postback) {
    if (postback != null && requestBody != null && !requestBody.isEmpty()) {
      url = new Gson().fromJson(requestBody, JsonObject.class).get("postbackUrl").getAsString();
      this.postback = postback;
    }
  }

  @Override
  public void run() {
    try {
      asyncHttpClient().preparePost(url).setBody(postback).execute().get().getResponseBody();
    } catch (InterruptedException e) {
      Log.warn("Interrupted on postback, url: " + url + ", postback: " + postback, e);
    } catch (ExecutionException e) {
      Log.warn("ExecutionException on postback, url: " + url + ", postback: " + postback, e);
    }
  }

  public void startIfNotNull() {
    if (url != null && postback != null) {
      start();
    }
  }
}
