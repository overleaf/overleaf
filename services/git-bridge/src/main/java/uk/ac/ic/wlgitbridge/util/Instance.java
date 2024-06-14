package uk.ac.ic.wlgitbridge.util;

import com.google.api.client.http.HttpRequestFactory;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

/*
 * Created by winston on 25/10/15.
 */
public class Instance {

  public static final HttpTransport httpTransport = new NetHttpTransport();

  public static final HttpRequestFactory httpRequestFactory = httpTransport.createRequestFactory();

  public static final JsonFactory jsonFactory = new GsonFactory();

  public static final Gson prettyGson =
      new GsonBuilder().setPrettyPrinting().serializeNulls().disableHtmlEscaping().create();

  public static final Gson gson = new Gson();
}
