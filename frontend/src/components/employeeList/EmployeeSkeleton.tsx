import React from 'react';

export const SKELETON_ROW_COUNT = 5;

export const EmployeeSkeletonRow: React.FC = () => (
  <tr className="animate-pulse border-b border-gray-200/20">
    <td className="p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gray-300/30" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="h-2.5 w-3/4 rounded bg-gray-300/30" />
          <div className="h-2 w-1/2 rounded bg-gray-300/20" />
        </div>
      </div>
    </td>
    <td className="p-6">
      <div className="h-2.5 w-2/3 rounded bg-gray-300/30" />
    </td>
    <td className="p-6">
      <div className="h-2.5 w-3/4 rounded bg-gray-300/20" />
    </td>
    <td className="p-6">
      <div className="h-2.5 w-1/2 rounded bg-gray-300/30" />
    </td>
    <td className="p-6">
      <div className="h-5 w-16 rounded-full bg-gray-300/20" />
    </td>
    <td className="p-6">
      <div className="flex gap-2">
        <div className="h-5 w-5 rounded bg-gray-300/20" />
        <div className="h-5 w-5 rounded bg-gray-300/20" />
      </div>
    </td>
  </tr>
);

export const EmployeeSkeletonCard: React.FC = () => (
  <div className="animate-pulse rounded-3xl border border-hi bg-[var(--surface)]/80 p-5">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-full bg-gray-300/30" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-1/2 rounded bg-gray-300/30" />
        <div className="h-2.5 w-2/3 rounded bg-gray-300/20" />
      </div>
    </div>
    <div className="mt-4 grid gap-2">
      <div className="h-2.5 w-full rounded bg-gray-300/20" />
      <div className="h-2.5 w-5/6 rounded bg-gray-300/20" />
      <div className="h-2.5 w-2/5 rounded bg-gray-300/20" />
    </div>
  </div>
);
