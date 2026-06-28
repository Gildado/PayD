import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ContributorRewards from '../pages/ContributorRewards';
import { expect, test, describe } from 'vitest';

describe('ContributorRewards', () => {
  const renderComponent = () =>
    render(
      <BrowserRouter>
        <ContributorRewards />
      </BrowserRouter>
    );

  test('renders the hero section with title', () => {
    renderComponent();
    expect(screen.getByText(/Solve Issues./i)).toBeInTheDocument();
    expect(screen.getByText(/Earn Rewards./i)).toBeInTheDocument();
  });

  test('renders the reward tiers', () => {
    renderComponent();
    expect(screen.getByText('Minor')).toBeInTheDocument();
    expect(screen.getByText('Major')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
    expect(screen.getByText('500 XLM')).toBeInTheDocument();
    expect(screen.getByText('2000 XLM')).toBeInTheDocument();
  });

  test('renders the "How it Works" section', () => {
    renderComponent();
    expect(screen.getByText(/How it/i)).toBeInTheDocument();
    expect(screen.getByText('Works')).toBeInTheDocument();
    expect(screen.getByText('Find an Issue')).toBeInTheDocument();
    expect(screen.getByText('Claim and Solve')).toBeInTheDocument();
    expect(screen.getByText('Get Approved')).toBeInTheDocument();
    expect(screen.getByText('Instant Payout')).toBeInTheDocument();
  });

  test('renders the GitHub link', () => {
    renderComponent();
    const githubLink = screen.getByRole('link', { name: /Browse Reward Issues/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', expect.stringContaining('github.com'));
  });

  test('renders the requirements section', () => {
    renderComponent();
    expect(screen.getByText('Payout Requirements')).toBeInTheDocument();
    expect(screen.getByText(/Stellar wallet address/i)).toBeInTheDocument();
  });
});
