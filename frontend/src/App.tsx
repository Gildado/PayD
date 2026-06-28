import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Debugger from './pages/Debugger';
import PayrollScheduler from './pages/PayrollScheduler';
import EmployeeEntry from './pages/EmployeeEntry';
import AppLayout from './components/AppLayout';
import EmployerLayout from './components/EmployerLayout';
import HelpCenter from './pages/HelpCenter';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import Settings from './pages/Settings';
import CustomReportBuilder from './pages/CustomReportBuilder';
import CrossAssetPayment from './pages/CrossAssetPayment';
import TransactionHistory from './pages/TransactionHistory';
import RevenueSplitDashboard from './pages/RevenueSplitDashboard';
import BulkPayrollUpload from './pages/BulkPayrollUpload';
import PayrollAnalytics from './pages/PayrollAnalytics';
import ContributorRewards from './pages/ContributorRewards';
import EmployeePortal from './pages/EmployeePortal';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import AdminPanel from './pages/AdminPanel';
import ProtectedRoute from './components/ProtectedRoute';
import { useTranslation } from 'react-i18next';
import { contractService } from './services/contracts';

function noop(): void {
  // intentional no-op for ErrorFallback onReset when no reset handler is needed
}

function App() {
  const { t } = useTranslation();

  // Initialize contract service on app startup
  useEffect(() => {
    contractService.initialize().catch((error) => {
      console.error('Failed to initialize contract service:', error);
    });
  }, []);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth-callback" element={<AuthCallback />} />

        {/* Protected: any authenticated user */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.homeTitle')}
                    description={t('errorFallback.homeDescription')}
                  />
                }
              >
                <Home />
              </ErrorBoundary>
            }
          />
          <Route
            path="/settings"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <Settings />
              </ErrorBoundary>
            }
          />
          <Route
            path="/help"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <HelpCenter />
              </ErrorBoundary>
            }
          />
          <Route
            path="/transactions"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <TransactionHistory />
              </ErrorBoundary>
            }
          />
        </Route>

        {/* Employer-only routes */}
        <Route element={<ProtectedRoute allowedRoles={['EMPLOYER']} />}>
          <Route
            path="/payroll"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.payrollTitle')}
                    description={t('errorFallback.payrollDescription')}
                  />
                }
              >
                <PayrollScheduler />
              </ErrorBoundary>
            }
          />
          <Route
            path="/employee"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.employeesTitle')}
                    description={t('errorFallback.employeesDescription')}
                  />
                }
              >
                <EmployeeEntry />
              </ErrorBoundary>
            }
          />
          <Route
            path="/reports"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <CustomReportBuilder />
              </ErrorBoundary>
            }
          />
          <Route
            path="/debug"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.debuggerTitle')}
                    description={t('errorFallback.debuggerDescription')}
                  />
                }
              >
                <Debugger />
              </ErrorBoundary>
            }
          />
          <Route
            path="/debug/:contractName"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.debuggerTitle')}
                    description={t('errorFallback.debuggerDescription')}
                  />
                }
              >
                <Debugger />
              </ErrorBoundary>
            }
          />
          <Route
            path="/cross-asset-payment"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <CrossAssetPayment />
              </ErrorBoundary>
            }
          />
          <Route
            path="/revenue-split"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <RevenueSplitDashboard />
              </ErrorBoundary>
            }
          />
          <Route
            path="/analytics"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <PayrollAnalytics />
              </ErrorBoundary>
            }
          />
          <Route
            path="/bulk-upload"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <BulkPayrollUpload />
              </ErrorBoundary>
            }
          />
          <Route
            path="/rewards"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <ContributorRewards />
              </ErrorBoundary>
            }
          />
          <Route
            path="/admin"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title="Admin panel error"
                    description="Something went wrong loading the admin tools."
                  />
                }
              >
                <AdminPanel />
              </ErrorBoundary>
            }
          />
        </Route>

        {/* Employee-only routes */}
        <Route element={<ProtectedRoute allowedRoles={['EMPLOYEE']} />}>
          <Route
            path="/portal"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title="Employee Portal Error"
                    description="Something went wrong loading your portal."
                  />
                }
              >
                <EmployeePortal />
              </ErrorBoundary>
            }
          />
        </Route>
      </Route>

      {/* Employer section with EmployerLayout */}
      <Route element={<ProtectedRoute allowedRoles={['EMPLOYER']} />}>
        <Route path="/employer" element={<EmployerLayout />}>
          <Route index element={<Navigate to="payroll" replace />} />
          <Route
            path="payroll"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.payrollTitle')}
                    description={t('errorFallback.payrollDescription')}
                  />
                }
              >
                <PayrollScheduler />
              </ErrorBoundary>
            }
          />
          <Route
            path="employee"
            element={
              <ErrorBoundary
                fallback={
                  <ErrorFallback
                    title={t('errorFallback.employeesTitle')}
                    description={t('errorFallback.employeesDescription')}
                  />
                }
              >
                <EmployeeEntry />
              </ErrorBoundary>
            }
          />
          <Route
            path="reports"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <CustomReportBuilder />
              </ErrorBoundary>
            }
          />
          <Route
            path="cross-asset-payment"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <CrossAssetPayment />
              </ErrorBoundary>
            }
          />
          <Route
            path="transactions"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <TransactionHistory />
              </ErrorBoundary>
            }
          />
          <Route
            path="revenue-split"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <RevenueSplitDashboard />
              </ErrorBoundary>
            }
          />
          <Route
            path="analytics"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <PayrollAnalytics />
              </ErrorBoundary>
            }
          />
          <Route
            path="bulk-upload"
            element={
              <ErrorBoundary fallback={<ErrorFallback />}>
                <BulkPayrollUpload />
              </ErrorBoundary>
            }
          />
          <Route
            path="settings"
            element={
              <ErrorBoundary fallback={<ErrorFallback onReset={noop} />}>
                <Settings />
              </ErrorBoundary>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
