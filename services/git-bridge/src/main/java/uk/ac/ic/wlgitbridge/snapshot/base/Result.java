package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;

/*
 * Created by Winston on 06/11/14.
 */
public abstract class Result implements JSONSource {

  private JsonElement json;
  private Request request;

  public Result(Request request, JsonElement json) {
    this.request = request;
    this.json = json;
    fromJSON(json);
  }

  protected Result() {}

  public Request getRequest() {
    return request;
  }

  public abstract JsonElement toJson();

  @Override
  public String toString() {
    if (json == null) {
      return "result";
    }
    return json.toString();
  }
}
