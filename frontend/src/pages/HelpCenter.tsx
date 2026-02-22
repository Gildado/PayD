import { useState } from "react";
import { ChevronDown } from "lucide-react";

const docs = [
  {
    category: "FAQs",
    items: [
      {
        question: "How do I add an employee?",
        answer:
          "Go to the Employees page and click 'Add Employee'. Fill in the required details and save.",
      },
      {
        question: "How do I reset my password?",
        answer:
          "Click your profile in the sidebar, then select 'Reset Password' and follow the instructions.",
      },
    ],
  },
  {
    category: "Stellar Concepts",
    items: [
      {
        question: "What is a trustline?",
        answer:
          "A trustline is a permission you grant to hold a specific asset on the Stellar network.",
      },
      {
        question: "What is an anchor?",
        answer:
          "An anchor is an entity that issues assets and connects the Stellar network to traditional banking.",
      },
    ],
  },
  {
    category: "Troubleshooting",
    items: [
      {
        question: "Payroll failed to send.",
        answer:
          "Check your account balance and trustlines. Ensure all employees have valid Stellar addresses.",
      },
      {
        question: "Employee not receiving payments.",
        answer:
          "Verify the employee’s Stellar address and that they have established the necessary trustlines.",
      },
    ],
  },
];

export default function HelpCenter() {
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenItem(openItem === id ? null : id);
  };

  const filteredDocs = docs
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">
            Help <span className="text-(--accent)">Center</span>
          </h1>
          <p className="text-(--muted) text-sm font-mono uppercase tracking-widest">
            Documentation · FAQs · Troubleshooting
          </p>
        </div>

        {/* Search */}
        <div className="mb-10">
          <input
            type="text"
            placeholder="Search documentation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-(--accent) text-sm transition"
          />
        </div>

        {/* Results */}
        {filteredDocs.length === 0 && (
          <p className="text-center text-(--muted)">No results found.</p>
        )}

        {/* Accordion Sections */}
        <div className="space-y-10">
          {filteredDocs.map((section) => (
            <div key={section.category}>
              <h2 className="text-lg font-bold mb-4 text-(--accent2) uppercase tracking-wide">
                {section.category}
              </h2>

              <div className="space-y-3">
                {section.items.map((item, idx) => {
                  const id = `${section.category}-${idx}`;
                  const isOpen = openItem === id;

                  return (
                    <div
                      key={id}
                      className="border border-white/10 rounded-xl bg-white/5 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItem(id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left font-medium hover:bg-white/10 transition"
                      >
                        <span>{item.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-5 py-4 text-sm text-(--muted) leading-relaxed">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
