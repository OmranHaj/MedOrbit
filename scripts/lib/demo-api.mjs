/** Cookie values stay in process memory only; never log or write this client to disk. */
export function demoClient(base = process.env.TEST_BASE_URL || "http://localhost:80/api") {
  const cookies = new Map();
  return async (path, method = "GET", body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";")[0];
      const pos = pair.indexOf("=");
      cookies.set(pair.slice(0, pos), pair.slice(pos + 1));
    }
    return { status: response.status, data: await response.json(), headers: response.headers };
  };
}
