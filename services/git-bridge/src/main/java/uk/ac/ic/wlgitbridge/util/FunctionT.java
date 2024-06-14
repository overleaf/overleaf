package uk.ac.ic.wlgitbridge.util;

/*
 * Function interface that allows checked exceptions.
 * @param <T>
 * @param <R>
 * @param <E>
 */
@FunctionalInterface
public interface FunctionT<T, R, E extends Throwable> {

  R apply(T t) throws E;
}
