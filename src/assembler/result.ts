export type Result<T, E> = { ok: true, value: T } | { ok: false, error: E }

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const and_then = <T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>) => r.ok ? f(r.value) : r;
