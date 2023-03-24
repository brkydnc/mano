export type Result<T, E> = { ok: true, value: T } | { ok: false, error: E }

const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export { Ok, Err };

