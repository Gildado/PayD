import { Icon } from "@stellar/design-system";
import { EmployeeList } from "../components/EmployeeList";

export default function EmployeeEntry() {

    const mockEmployees = [
        {
            id: "1",
            name: "Wilfred G.",
            email: "wilfred@example.com",
            imageUrl: "",
            position: "Lead Developer",
            wallet: "GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6",
            status: "Active" as "Active",
        },
        {
            id: "2",
            name: "Chinelo A.",
            email: "chinelo@example.com",
            imageUrl: "",
            position: "Product Manager",
            wallet: "GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6",
            status: "Active" as "Active",
        },
        {
            id: "3",
            name: "Emeka N.",
            email: "emeka@example.com",
            imageUrl: "https://i.pravatar.cc/150?img=3", // custom image
            position: "UX Designer",
            wallet: "GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6",
            status: "Active" as "Active",
        },
        {
            id: "4",
            name: "Fatima K.",
            email: "fatima@example.com",
            imageUrl: "",
            position: "HR Specialist",
            wallet: "GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6",
            status: "Active" as "Active",
        }
    ];


    return (
        <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full">
            <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
                <div>
                    <h1 className="text-4xl font-black mb-2 tracking-tight">Workforce <span className="text-accent">Directory</span></h1>
                    <p className="text-muted font-mono text-sm tracking-wider uppercase">Employee roster and compliance</p>
                </div>
                <button id="tour-add-employee" className="px-5 py-2.5 bg-accent text-bg font-bold rounded-lg hover:bg-accent/90 transition-all flex items-center gap-2 text-sm shadow-lg shadow-accent/10">
                    <Icon.Plus size="sm" />
                    Add Employee
                </button>
            </div>

            <EmployeeList
                employees={mockEmployees}
                onEmployeeClick={(employee) => alert(`Clicked: ${employee.name}`)}
            />

        </div>
    );
}
