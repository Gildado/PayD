import React from "react";
import { Card, Icon, Button } from "@stellar/design-system";

export default function Debugger() {
  return (
    <div className="p-12 max-w-7xl mx-auto space-y-8 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Contract <span className="text-accent">Debugger</span>
        </h1>
        <p className="text-gray-500">
          Test and interact with your Soroban smart contracts.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-8 text-center bg-gray-50/50 p-12 rounded-2xl border-2 border-dashed border-gray-100">
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-white text-gray-400 rounded-lg flex items-center justify-center shadow-sm">
            <Icon.Code02 size="sm" />
          </div>
          <h3 className="font-bold">Select Contract</h3>
        </div>
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-white text-gray-400 rounded-lg flex items-center justify-center shadow-sm">
            <Icon.Play size="sm" />
          </div>
          <h3 className="font-bold">Invoke Function</h3>
        </div>
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-white text-gray-400 rounded-lg flex items-center justify-center shadow-sm">
            <Icon.CheckDone01 size="sm" />
          </div>
          <h3 className="font-bold">Verify Output</h3>
        </div>
      </div>
    </div>
  );
}
