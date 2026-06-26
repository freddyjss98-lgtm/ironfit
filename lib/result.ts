// Resultado uniforme para Server Actions.
// En producción Next oculta el mensaje de los `throw` (muestra un error genérico
// "Server Components render..."). Por eso las acciones devuelven el error como
// dato — { ok: false, error } — para que el mensaje real llegue al cliente.

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ActionData<T> = { ok: true; data: T } | { ok: false; error: string };
