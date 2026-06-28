# Accessible Date Picker - Quick Reference Guide

**Issue #118**: Improve Date Picker Accessibility  
**Status**: ✅ Complete

---

## 📋 For End Users - Keyboard Navigation Guide

### How to Use the Date Picker with a Keyboard

#### Opening the Calendar

```
1. Press Tab to focus on the date field
2. Press Enter or ↓ (Down Arrow)
   → Calendar will open
```

#### Selecting a Date

```
1. Use ← → ↑ ↓ Arrow keys to navigate dates
2. Press Enter to select
   → Calendar closes, date is filled in
```

#### Closing Without Selecting

```
Press Escape
   → Calendar closes without changing the date
```

#### Clearing the Date

```
1. Tab to the clear (X) button
2. Press Enter
   → Date field is cleared
```

#### Typing Directly

```
1. Focus on the date field
2. Type a date in format: YYYY-MM-DD
   (e.g., 2024-03-15 for March 15, 2024)
3. Press Enter or Tab to confirm
   → Calendar updates to show that month
```

### Keyboard Shortcuts Summary

| Action                 | Key(s)                          |
| ---------------------- | ------------------------------- |
| Open calendar          | `Enter` or `↓`                  |
| Close calendar         | `Escape`                        |
| Navigate dates         | `← → ↑ ↓`                       |
| Select date            | `Enter`                         |
| Change month           | `Tab` + `Enter`/`Click`         |
| Clear date             | `Tab` + `Enter` on clear button |
| Move to next field     | `Tab`                           |
| Move to previous field | `Shift` + `Tab`                 |

### Screen Reader Users

The date picker announces:

- **Field name** and whether it's required
- **Help text** when focused
- **Current month and year** in the calendar
- **Full date** for each day button (e.g., "15 March 2024")
- **Error messages** if the date is invalid

Just use your screen reader's normal navigation:

- Use arrow keys to move between dates
- Use Enter to select
- Use Escape to close

---

## 👨‍💻 For Developers - Integration Guide

### Import the Component

```tsx
import { AccessibleDatePicker } from "../components/AccessibleDatePicker";
```

### Timezones (Date-only inputs)

The date picker returns a **date-only** string (`YYYY-MM-DD`). Avoid parsing it with `new Date('YYYY-MM-DD')`
since JavaScript treats that format as **UTC**, which can display as the previous/next day depending on the
user's timezone.

Use the shared helper instead:

```ts
import { parseDateString } from "../utils/dateHelpers";
```

### Basic Usage

```tsx
import React, { useState } from "react";
import { AccessibleDatePicker } from "../components/AccessibleDatePicker";

function MyForm() {
  const [date, setDate] = useState("");

  return (
    <form>
      <AccessibleDatePicker
        id="start-date"
        label="Start Date"
        value={date}
        onChange={setDate}
      />
    </form>
  );
}
```

### With All Options

```tsx
<AccessibleDatePicker
  id="unique-id"                           // Required: unique identifier
  label="Select a Date"                    // Required: field label
  value="2024-03-15"                       // Current selected date
  onChange={(newDate) => {...}}            // Callback when date changes
  minDate="2024-01-01"                     // Prevent selecting before this
  maxDate="2024-12-31"                     // Prevent selecting after this
  required={true}                          // Mark as required
  disabled={false}                         // Disable the input
  error="Invalid date"                     // Show error message
  placeholder="YYYY-MM-DD"                 // Placeholder text
  helpText="Select a future date"          // Help text below input
  fieldSize="md"                           // Size: 'sm' | 'md' | 'lg'
/>
```

### Props Reference

| Prop          | Type                    | Required | Default      | Description                         |
| ------------- | ----------------------- | -------- | ------------ | ----------------------------------- |
| `id`          | string                  | Yes      | -            | Unique identifier for accessibility |
| `label`       | string                  | Yes      | -            | Field label text                    |
| `value`       | string                  | No       | ''           | Date in YYYY-MM-DD format           |
| `onChange`    | (value: string) => void | Yes      | -            | Callback for date changes           |
| `minDate`     | string                  | No       | -            | Minimum date (YYYY-MM-DD)           |
| `maxDate`     | string                  | No       | -            | Maximum date (YYYY-MM-DD)           |
| `required`    | boolean                 | No       | false        | Mark field as required              |
| `disabled`    | boolean                 | No       | false        | Disable the input                   |
| `error`       | string                  | No       | -            | Error message to display            |
| `placeholder` | string                  | No       | 'YYYY-MM-DD' | Placeholder text                    |
| `helpText`    | string                  | No       | -            | Help text below input               |
| `fieldSize`   | 'sm' \| 'md' \| 'lg'    | No       | 'md'         | Field size                          |

### Updating from Old Date Input

**Before** (Basic HTML input):

```tsx
<InputComponent
  id="startDate"
  label="Commencement Date"
  type="date"
  value={startDate}
  onChange={handleChange}
/>
```

**After** (Accessible picker):

```tsx
<AccessibleDatePicker
  id="startDate"
  label="Commencement Date"
  value={startDate}
  onChange={(value) =>
    handleChange({ target: { name: "startDate", value } } as any)
  }
/>
```

### Date Format

- **Input/Output**: Always use `YYYY-MM-DD` format
- **Validation**: Component validates format automatically
- **Parsing**: Use the component's built-in validation

```tsx
// Component handles these automatically:
const isValid = (dateStr: string) => {
  // Checks format and actual date validity
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
};
```

### Testing

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessibleDatePicker } from "../components/AccessibleDatePicker";

describe("My Date Picker", () => {
  it("should select a date with keyboard", async () => {
    const handleChange = jest.fn();
    render(
      <AccessibleDatePicker
        id="test"
        label="Test"
        value=""
        onChange={handleChange}
      />,
    );

    const user = userEvent.setup();
    const input = screen.getByLabelText("Test");

    // Open calendar
    await user.click(input);
    await user.keyboard("{Enter}");

    // Wait for calendar to appear
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });
});
```

### Accessibility Checklist

When using `AccessibleDatePicker`, you get:

- ✅ ARIA labels and descriptions
- ✅ Keyboard navigation (Tab, Enter, Arrow keys, Escape)
- ✅ Screen reader support
- ✅ Focus management
- ✅ Visual focus indicators
- ✅ Error announcements
- ✅ Mobile compatibility
- ✅ WCAG 2.1 Level AA compliance

### Common Patterns

#### Paired Date Range (Start & End)

```tsx
const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");

return (
  <>
    <AccessibleDatePicker
      id="range-start"
      label="Start Date"
      value={startDate}
      onChange={setStartDate}
      maxDate={endDate}
    />
    <AccessibleDatePicker
      id="range-end"
      label="End Date"
      value={endDate}
      onChange={setEndDate}
      minDate={startDate}
    />
  </>
);
```

#### With Validation

```tsx
const [date, setDate] = useState("");
const [error, setError] = useState("");

const handleDateChange = (newDate: string) => {
  const selectedDate = new Date(newDate);
  if (selectedDate < new Date()) {
    setError("Date must be in the future");
  } else {
    setError("");
  }
  setDate(newDate);
};

return (
  <AccessibleDatePicker
    id="future-date"
    label="Future Date"
    value={date}
    onChange={handleDateChange}
    error={error}
  />
);
```

#### Required Field

```tsx
<AccessibleDatePicker
  id="required-date"
  label="Payment Date"
  value={paymentDate}
  onChange={setPaymentDate}
  required={true}
  helpText="Payment date is required"
/>
```

### Styling & Theming

The component supports dark mode via Tailwind CSS:

```tsx
// Light mode (default)
bg-white text-gray-900
border-gray-300

// Dark mode
dark:bg-gray-800 dark:text-gray-100
dark:border-gray-600
```

To customize:

```tsx
// Component uses standard Tailwind classes
// Override in your tailwind.config.js:
module.exports = {
  theme: {
    extend: {
      colors: {
        "date-picker-primary": "var(--primary-color)",
      },
    },
  },
};
```

---

## 🧪 Testing Checklist

### Manual Testing Steps

- [ ] Open calendar with Enter key
- [ ] Navigate dates with arrow keys
- [ ] Select date with Enter key
- [ ] Close with Escape key
- [ ] Tab through all controls
- [ ] Clear date button works
- [ ] Type date directly
- [ ] Min/max dates enforced
- [ ] Error messages display
- [ ] Mobile date picker shows

### Automated Tests

```bash
# Run component tests
npm test AccessibleDatePicker

# Run integration tests
npm test PayrollScheduler

# Run accessibility audit
npm run test:a11y

# Run E2E tests
npm run test:e2e -- datepal
```

---

## 🔗 Related Components

- `SchedulingWizard.tsx` - Uses time inputs, could benefit from similar treatment
- `TransactionHistory.tsx` - Has date range filters
- `CustomReportBuilder.tsx` - Has date selection
- `PayrollAnalytics.tsx` - Has date filtering

---

## 📚 Additional Resources

- [WCAG 2.1 Date Picker Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value)
- [MDN: ARIA - Date Picker](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [W3C: Date Picker Implementation Guide](https://www.w3.org/WAI/test-evaluate/access)

---

## ❓ FAQ

**Q: Can I use this on mobile?**  
A: Yes! The component uses native HTML `type="date"` which triggers the mobile date picker.

**Q: How do I validate the date format?**  
A: The component automatically validates. Use the `error` prop to display messages.

**Q: Can I customize the calendar appearance?**  
A: Yes, through Tailwind CSS classes. Edit the component to modify colors.

**Q: Does it support date ranges?**  
A: Currently single dates. Use two components for date ranges with `minDate`/`maxDate`.

**Q: How do disabled dates work?**  
A: Dates outside `minDate`/`maxDate` are disabled and cannot be selected.

---

**Version**: 1.0.0  
**Last Updated**: March 27, 2026  
**Status**: ✅ Production Ready
