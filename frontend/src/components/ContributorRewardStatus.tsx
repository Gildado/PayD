import { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance';
import { TOKEN_KEY } from '../providers/authConstants';

interface RewardStatus {
  id: string;
  status: string;
  data: { issueNumber: number; tier: string; amount: string; assetCode: string; txHash?: string };
}

/** Read-only visibility for the employer workflows; signing remains an explicit wallet action. */
export default function ContributorRewardStatus() {
  const [rewards, setRewards] = useState<RewardStatus[]>([]);
  const [status, setStatus] = useState('Loading reward workflow status…');
  const [refresh, setRefresh] = useState(0);
  const token = localStorage.getItem(TOKEN_KEY);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    axiosInstance
      .get<{ rewards: RewardStatus[] }>('/api/v1/workflows/rewards', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setRewards(data.rewards);
        setStatus(
          data.rewards.length ? 'Reward workflow status updated.' : 'No staged contributor rewards.'
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus('Unable to load reward workflow status. Try refreshing.');
      });
    return () => controller.abort();
  }, [refresh, token]);

  if (!token) return null;
  return (
    <section aria-labelledby="reward-workflow-title" className="glass rounded-2xl p-6 mb-12">
      <h2 id="reward-workflow-title" className="text-2xl font-bold mb-4">
        Reward workflow status
      </h2>
      <p role="status">{status}</p>
      <button
        type="button"
        className="border rounded px-4 py-2 my-4"
        onClick={() => {
          setStatus('Loading reward workflow status…');
          setRefresh((value) => value + 1);
        }}
      >
        Refresh rewards
      </button>
      <ul className="space-y-3">
        {rewards.map((reward) => (
          <li key={reward.id}>
            Issue #{reward.data.issueNumber}: {reward.data.tier} — {Number(reward.data.amount)}{' '}
            {reward.data.assetCode} — {reward.status.replace(/_/g, ' ')}
            {reward.data.txHash && (
              <p className="break-all text-sm">Transaction: {reward.data.txHash}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
