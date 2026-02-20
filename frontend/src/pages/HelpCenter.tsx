import { useState } from "react";

const docs = [
  {
    category: "FAQs",
    items: [
      {
        question: "How do I add an employee?",
        answer: "Go to the Employees page and click 'Add Employee'. Fill in the required details and save.",
      },
      {
        question: "How do I reset my password?",
        answer: "Click your profile in the sidebar, then select 'Reset Password' and follow the instructions.",
      },
    ],
  },
  {
    category: "Stellar Concepts",
    items: [
      {
        question: "What is a trustline?",
        answer: "A trustline is a permission you grant to hold a specific asset on the Stellar network.",
      },
      {
        question: "What is an anchor?",
        answer: "An anchor is an entity that issues assets and connects the Stellar network to traditional banking.",
      },
    ],
  },
  {
    category: "Troubleshooting",
    items: [
      {
        question: "Payroll failed to send.",
        answer: "Check your account balance and trustlines. Ensure all employees have valid Stellar addresses.",
      },
      {
        question: "Employee not receiving payments.",
        answer: "Verify the employee’s Stellar address and that they have established the necessary trustlines.",
      },
    ],
  },
];

export default function HelpCenter() {
  const [search, setSearch] = useState("");

  const filteredDocs = docs
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Help Center</h1>
      <input
        type="text"
        placeholder="Search documentation..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 px-4 py-2 border rounded"
      />
      {filteredDocs.length === 0 && (
        <p className="text-gray-500">No results found.</p>
      )}
      {filteredDocs.map((section) => (
        <div key={section.category} className="mb-8">
          <h2 className="text-xl font-semibold mb-2">{section.category}</h2>
          <ul>
            {section.items.map((item, idx) => (
              <li key={idx} className="mb-4">
                <p className="font-medium">{item.question}</p>
                <p className="text-gray-700">{item.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}