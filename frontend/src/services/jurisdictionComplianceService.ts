/**
 * Frontend service to fetch Jurisdiction Compliance Report data.
 */

export async function fetchJurisdictionComplianceReport(organizationId: number) {
  const response = await fetch(`/api/v1/compliance/jurisdiction-report?organizationId=${organizationId}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch jurisdiction compliance report');
  }
  return response.json();
}
