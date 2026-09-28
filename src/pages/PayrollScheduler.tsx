import React from "react";
import { Card, Icon, Button } from "@stellar/design-system";

export default function PayrollScheduler() {
  return (
    <div className="p-12 max-w-4xl mx-auto space-y-8 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Payroll <span className="text-accent">Scheduler</span>
        </h1>
        <p className="text-gray-500">
          Automate recurring payments to your workforce.
        </p>
      </div>

      <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
          <Icon.Calendar size="md" />
        </div>
        <div>
          <h3 className="text-xl font-bold">No Active Schedules</h3>
          <p className="text-gray-400 max-w-sm mx-auto">
            You haven't set up any automated payroll schedules yet. Connect your
            wallet to get started.
          </p>
        </div>
        <Button variant="primary" size="md" className="!bg-accent">
          Create First Schedule
        </Button>
      </Card>
    </div>
  );
}
