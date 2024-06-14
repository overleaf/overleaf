package uk.ac.ic.wlgitbridge.util;

/*
 * BiConsumer interface that allows checked exceptions.
 */
@FunctionalInterface
public interface BiConsumerT<T, U, E extends Throwable> {

  void accept(T t, U u) throws E;
}
