import axiosInstance from '../api/axiosInstance';

export interface ClaimableBalance {
  id: number;
  balance_id: string;
  organization_id: number;
  employee_id: number | null;
  payroll_run_id: number | null;
  payroll_item_id: number | null;
  claimant_public_key: string | null;
  amount: string;
  asset_code: string;
  asset_issuer: string | null;
  status: 'pending' | 'claimed' | 'expired' | 'clawed_back';
  sponsor_public_key: string;
  created_at: string;
  claimed_at: string | null;
  expires_at: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  claim_instructions: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface ClaimsSummary {
  total_pending: number;
  total_amount: string;
  by_asset: Record<string, { count: number; amount: string }>;
}

export interface PaginatedClaims {
  data: ClaimableBalance[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

class ClaimableBalanceService {
  private readonly baseUrl = '/api/v1/claims';

  async getPendingClaims(page = 1, limit = 20): Promise<PaginatedClaims> {
    const response = await axiosInstance.get<PaginatedClaims>(`${this.baseUrl}/`, {
      params: { page, limit },
    });
    return response.data;
  }

  async getClaimsSummary(): Promise<ClaimsSummary> {
    const response = await axiosInstance.get<{ success: boolean; data: ClaimsSummary }>(
      `${this.baseUrl}/summary`
    );
    return response.data.data;
  }

  async getEmployeeClaims(
    employeeId: number,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<PaginatedClaims> {
    const response = await axiosInstance.get<PaginatedClaims>(
      `${this.baseUrl}/employee/${employeeId}`,
      {
        params: options,
      }
    );
    return response.data;
  }

  async getClaimById(id: number): Promise<ClaimableBalance> {
    const response = await axiosInstance.get<{ success: boolean; data: ClaimableBalance }>(
      `${this.baseUrl}/${id}`
    );
    return response.data.data;
  }

  async createClaimableBalance(params: {
    employee_id?: number;
    payroll_run_id?: number;
    payroll_item_id?: number;
    claimant_public_key: string;
    amount: string;
    asset_code: string;
    asset_issuer?: string;
    sponsor_secret: string;
    claim_instructions?: string;
    expires_in_days?: number;
  }): Promise<{
    id: number;
    balance_id: string;
    amount: string;
    asset_code: string;
    claimant_public_key: string;
    status: string;
    claim_instructions: string;
  }> {
    const response = await axiosInstance.post<{
      success: boolean;
      data: {
        id: number;
        balance_id: string;
        amount: string;
        asset_code: string;
        claimant_public_key: string;
        status: string;
        claim_instructions: string;
      };
    }>(`${this.baseUrl}/`, params);
    return response.data.data;
  }

  async markAsClaimed(id: number): Promise<ClaimableBalance> {
    const response = await axiosInstance.post<{ success: boolean; data: ClaimableBalance }>(
      `${this.baseUrl}/${id}/mark-claimed`
    );
    return response.data.data;
  }

  async sendClaimNotification(id: number): Promise<void> {
    await axiosInstance.post(`${this.baseUrl}/${id}/notify`);
  }

  async generateClaimInstructions(
    assetCode: string,
    assetIssuer?: string,
    amount?: string
  ): Promise<string> {
    const response = await axiosInstance.get<{ success: boolean; data: { instructions: string } }>(
      `${this.baseUrl}/instructions/generate`,
      {
        params: { asset_code: assetCode, asset_issuer: assetIssuer, amount },
      }
    );
    return response.data.data.instructions;
  }

  formatClaimStatus(status: ClaimableBalance['status']): {
    label: string;
    color: string;
  } {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: 'yellow' };
      case 'claimed':
        return { label: 'Claimed', color: 'green' };
      case 'expired':
        return { label: 'Expired', color: 'gray' };
      case 'clawed_back':
        return { label: 'Clawed Back', color: 'red' };
      default:
        return { label: 'Unknown', color: 'gray' };
    }
  }

  formatClaimAmount(amount: string, assetCode: string): string {
    const numAmount = parseFloat(amount);
    return `${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} ${assetCode}`;
  }

  getTimeUntilExpiry(expiresAt: string | null): string | null {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  }
}

export const claimService = new ClaimableBalanceService();
