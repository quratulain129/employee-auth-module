// Last-resort handlers. They return generic messages: no stack traces, tokens or configuration details reach the client.
export function notFound(req, res) {
  res.status(404).json({ error: 'not_found', message: 'Resource not found.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[server error]', err?.name, err?.message); // name + message only, never the full request
  res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
}
