package uk.ac.ic.wlgitbridge.snapshot.base;

import com.google.gson.JsonElement;

/*
 * Created by Winston on 06/11/14.
 */
public interface JSONSource {

  void fromJSON(JsonElement json);
}
