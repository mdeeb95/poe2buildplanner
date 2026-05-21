/** Fetch large app JSON routes; relies on server ETag revalidation (not force-cache). */
export async function fetchAppJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
