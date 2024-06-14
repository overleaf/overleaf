package uk.ac.ic.wlgitbridge.bridge.util;

import com.google.common.base.Preconditions;

/*
 * Created by winston on 01/07/2017.
 */
public class CastUtil {

  public static int assumeInt(long l) {
    Preconditions.checkArgument(
        l <= (long) Integer.MAX_VALUE && l >= (long) Integer.MIN_VALUE,
        l + " cannot fit inside an int");
    return (int) l;
  }
}
