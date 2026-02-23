import { Button, Icon, Layout } from "@stellar/design-system";
import "./App.module.css";
import ConnectAccount from "./components/ConnectAccount.tsx";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
// import Home from "./pages/Home";
import Debugger from "./pages/Debugger.tsx";
import PayrollScheduler from "./pages/PayrollScheduler";
import EmployeeEntry from "./pages/EmployeeEntry";
import FeeEstimation from "./pages/FeeEstimation";

const AppLayout: React.FC = () => (
  <main>
    <Layout.Header
      projectId="PayD"
      projectTitle="PayD"
      contentRight={
        <>
          <nav className="flex space-x-4">
            <NavLink
              to="/payroll"
              className={({ isActive }: { isActive: boolean }) =>
                `text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
              }
            >
              Payroll
            </NavLink>
            <NavLink
              to="/employee"
              className={({ isActive }: { isActive: boolean }) =>
                `text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
              }
            >
              Employees
            </NavLink>
            <NavLink
              to="/fees"
              className={({ isActive }: { isActive: boolean }) =>
                `text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
              }
            >
              Fee Estimator
            </NavLink>
            <NavLink
              to="/debug"
              style={{
                textDecoration: "none",
              }}
            >
              {({ isActive }) => (
                <Button
                  variant="tertiary"
                  size="md"
                  onClick={() => (window.location.href = "/debug")}
                  disabled={isActive}
                >
                  <Icon.Code02 size="md" />
                  Debugger
                </Button>
              )}
            </NavLink>
          </nav>
          <ConnectAccount />
        </>
      }
    />
    <Outlet />
    <Layout.Footer>
      <span>
        © {new Date().getFullYear()} PayD. Licensed under the{" "}
        <a
          href="http://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apache License, Version 2.0
        </a>
        .
      </span>
    </Layout.Footer>
  </main>
);

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* <Route path="/" element={<Home />} /> */}
        <Route path="/payroll" element={<PayrollScheduler />} />
        <Route path="/employee" element={<EmployeeEntry />} />
        <Route path="/fees" element={<FeeEstimation />} />
        <Route path="/debug" element={<Debugger />} />
        <Route path="/debug/:contractName" element={<Debugger />} />
      </Route>
    </Routes>
  );
}

export default App;
