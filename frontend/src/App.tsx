import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Debugger from "./pages/Debugger";
import PayrollScheduler from "./pages/PayrollScheduler";
import EmployeeEntry from "./pages/EmployeeEntry";
import AppLayout from "./components/AppLayout";
import HelpCenter from "./pages/HelpCenter";



function App() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/payroll" element={<PayrollScheduler />} />
                <Route path="/employee" element={<EmployeeEntry />} />
                <Route path="/debug" element={<Debugger />} />
                <Route path="/debug/:contractName" element={<Debugger />} />
                <Route path="/help" element={<HelpCenter />} /> {/* Added Help Center route */}
            </Route>
        </Routes>
    );
}

export default App;
