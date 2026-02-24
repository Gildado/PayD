import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Debugger from './pages/Debugger';
import PayrollScheduler from './pages/PayrollScheduler';
import EmployeeEntry from './pages/EmployeeEntry';
import AppLayout from './components/AppLayout';
import HelpCenter from './pages/HelpCenter';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import Settings from './pages/Settings';
import CustomReportBuilder from './pages/CustomReportBuilder';
import CrossAssetPayment from './pages/CrossAssetPayment';
import TransactionHistory from './pages/TransactionHistory';
import EmployeePortal from './pages/EmployeePortal';
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();

  return (
    <Routes>
      <Route element={<AppLayout />}>
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
          path="/settings"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <Settings />
            </ErrorBoundary>
          }
        />
        <Route
          path="/help"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <HelpCenter />
            </ErrorBoundary>
          }
        />
        <Route
          path="/cross-asset-payment"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <CrossAssetPayment />
            </ErrorBoundary>
          }
        />
        <Route
          path="/transactions"
          element={
            <ErrorBoundary fallback={<ErrorFallback onReset={() => {}} />}>
              <TransactionHistory />
            </ErrorBoundary>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
