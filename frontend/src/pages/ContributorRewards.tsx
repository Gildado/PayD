import React from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Star,
  Zap,
  Github,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Gift,
  LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './ContributorRewards.module.css';

const RewardTier = ({
  tier,
  amount,
  description,
  icon: Icon,
  color,
}: {
  tier: string;
  amount: string;
  description: string;
  icon: LucideIcon;
  color: string;
}) => (
  <motion.div
    whileHover={{ y: -5 }}
    className={`${styles.rewardCard} glass noise border border-white/10 p-6 rounded-2xl flex flex-col items-center text-center`}
  >
    <div
      className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6`}
      style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
    >
      <Icon className="w-7 h-7" style={{ color }} />
    </div>
    <h3 className="text-sm font-bold uppercase tracking-widest text-(--muted) mb-2">{tier}</h3>
    <div className="text-3xl font-black mb-4 tracking-tight" style={{ color }}>
      {amount}
    </div>
    <p className="text-sm text-(--muted) leading-relaxed">{description}</p>
  </motion.div>
);

const ContributorRewards: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-20 relative"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-(--accent) opacity-5 blur-[100px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--accent)/10 border border-(--accent)/20 text-(--accent) text-[10px] font-bold uppercase tracking-widest mb-6">
          <Sparkles className="w-3 h-3" />
          Rewards Program
        </div>

        <h1 className="text-6xl font-black tracking-tight mb-6 leading-tight">
          Solve Issues. <span className="text-(--accent)">Earn Rewards.</span>
        </h1>
        <p className="text-xl text-(--muted) max-w-3xl mx-auto leading-relaxed">
          We believe in rewarding the developers who help build the future of PayD. Solve
          high-priority issues and get paid directly in XLM or USDC on the Stellar network.
        </p>
      </motion.div>

      {/* Tiers Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        <RewardTier
          tier="Minor"
          amount="100 XLM"
          description="Bug fixes, documentation improvements, and small UI enhancements."
          icon={Zap}
          color="var(--accent2)"
        />
        <RewardTier
          tier="Major"
          amount="500 XLM"
          description="Feature implementations, complex bug fixes, and performance optimizations."
          icon={Star}
          color="var(--accent)"
        />
        <RewardTier
          tier="Critical"
          amount="2000 XLM"
          description="Security vulnerabilities, core protocol changes, and critical architecture improvements."
          icon={Trophy}
          color="#ff4a4a"
        />
      </div>

      {/* How it Works */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-black mb-8 tracking-tight">
            How it <span className="text-(--accent)">Works</span>
          </h2>
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="font-bold mb-1">Find an Issue</h4>
                <p className="text-sm text-(--muted)">
                  Look for issues with the <span className="text-(--accent)">reward-eligible</span>{' '}
                  label on our GitHub repository.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="font-bold mb-1">Claim and Solve</h4>
                <p className="text-sm text-(--muted)">
                  Comment on the issue to express interest. Once assigned, submit your PR with
                  high-quality code and tests.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="font-bold mb-1">Get Approved</h4>
                <p className="text-sm text-(--muted)">
                  A maintainer will review your work. Once merged, you're eligible for the reward.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="font-bold mb-1">Instant Payout</h4>
                <p className="text-sm text-(--muted)">
                  Provide your Stellar address. The reward will be sent via our automated payroll
                  engine.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass p-8 rounded-3xl border border-white/10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Gift className="w-32 h-32" />
          </div>
          <h3 className="text-2xl font-bold mb-6">Ready to Contribute?</h3>
          <ul className="space-y-4 mb-8">
            <li className="flex items-center gap-3 text-sm text-(--muted)">
              <CheckCircle2 className="w-4 h-4 text-success" />
              High-quality, tested code is required
            </li>
            <li className="flex items-center gap-3 text-sm text-(--muted)">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Responsive and accessible UI components
            </li>
            <li className="flex items-center gap-3 text-sm text-(--muted)">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Proper documentation updates
            </li>
          </ul>
          <div className="flex flex-col gap-4">
            <a
              href="https://github.com/Gildado/PayD/issues?q=is%3Aopen+is%3Aissue+label%3A%22reward-eligible%22"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-4 bg-(--accent) text-bg font-bold rounded-xl hover:opacity-90 transition shadow-lg shadow-(--accent)/20"
            >
              <Github className="w-5 h-5" />
              Browse Reward Issues
            </a>
            <Link
              to="/help"
              className="flex items-center justify-center gap-2 px-6 py-4 glass border border-white/10 rounded-xl hover:bg-white/5 transition"
            >
              Read Contribution Guide
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Requirements Section */}
      <div className="p-12 glass noise rounded-3xl border border-white/10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8">
          <Wallet className="w-8 h-8 text-(--accent)" />
        </div>
        <h2 className="text-3xl font-black mb-4">Payout Requirements</h2>
        <p className="text-(--muted) max-w-2xl mx-auto mb-8">
          To receive your reward, you must have a valid Stellar wallet address and a trustline for
          the asset being paid (if not native XLM). We recommend using the
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--accent) mx-1 hover:underline"
          >
            Freighter wallet
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default ContributorRewards;
