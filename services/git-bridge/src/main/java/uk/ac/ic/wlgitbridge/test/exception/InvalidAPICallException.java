package uk.ac.ic.wlgitbridge.test.exception;

/**
 * Created by Winston on 09/01/15.
 */
public class InvalidAPICallException extends Exception {

    public InvalidAPICallException(String target) {
        super(target);
    }

}
