export async function fetchAnomalySummaryDigest(organizationId: number = 1): Promise<any> {
  const res = await fetch(`/api/v1/anomaly-digest?organizationId=${organizationId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch anomaly summary digest');
  }
  const json = await res.json();
  return json.data;
}
