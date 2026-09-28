# UI/UX Refinement Part 49 - Component Guide

## Overview

This guide covers the new UI components and enhancements introduced in UI/UX Refinement Part 49. These components follow the Stellar Wave design system and maintain high accessibility standards (WCAG 2.1 AA).

## New Components

### 1. StatusBadge

A versatile status indicator component with multiple variants and sizes.

**Props:**
- `variant`: 'success' | 'pending' | 'warning' | 'error' | 'loading' | 'neutral'
- `label`: Status label text
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `className`: Additional CSS classes

**Example:**

```tsx
import { StatusBadge } from '@/components/StatusBadge';

export function PaymentStatus() {
  return (
    <div className="space-y-4">
      <StatusBadge variant="success" label="Completed" />
      <StatusBadge variant="pending" label="Processing" size="lg" />
      <StatusBadge variant="error" label="Failed" size="sm" />
      <StatusBadge variant="loading" label="In Progress" />
    </div>
  );
}
```

**Accessibility:**
- Uses semantic `role="status"` attribute
- Includes proper ARIA labels
- Icons are automatically included based on status
- Keyboard accessible

---

### 2. ProgressBar

A customizable progress indicator with gradient support and completion detection.

**Props:**
- `value`: Number (0-100) - current progress
- `showLabel`: boolean - show percentage label
- `variant`: 'success' | 'warning' | 'error' | 'info' | 'neutral'
- `size`: 'sm' | 'md' | 'lg'
- `animated`: boolean - show pulse animation
- `ariaLabel`: Custom ARIA label

**Example:**

```tsx
import { ProgressBar } from '@/components/ProgressBar';

export function UploadProgress() {
  const [progress, setProgress] = useState(0);

  return (
    <div className="w-full space-y-4">
      <ProgressBar 
        value={progress} 
        showLabel={true}
        variant="info"
        ariaLabel="File upload progress"
      />
      
      {progress === 100 && (
        <p className="text-green-400">Upload complete!</p>
      )}
    </div>
  );
}
```

**Accessibility:**
- Proper `role="progressbar"` with ARIA attributes
- Shows completion status with visual indicator
- Screen reader friendly

---

### 3. PaginationControls

A fully accessible pagination component with keyboard navigation.

**Props:**
- `currentPage`: number - current page (1-indexed)
- `totalPages`: number - total number of pages
- `onPageChange`: (page: number) => void - callback
- `maxVisiblePages`: number - visible page buttons (default: 5)
- `showFirstLast`: boolean - show first/last buttons
- `disabled`: boolean - disable pagination

**Example:**

```tsx
import { PaginationControls } from '@/components/PaginationControls';

export function EmployeeList() {
  const [page, setPage] = useState(1);
  const totalPages = 10;

  return (
    <div>
      {/* Content */}
      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

**Accessibility:**
- Full keyboard navigation (Tab, Arrow keys)
- ARIA labels on all buttons
- Page buttons have `aria-current="page"` when active
- Screen reader friendly

---

### 4. EmptyState

Displays an empty state with optional action buttons.

**Props:**
- `title`: string - empty state title
- `description`: string - additional description
- `icon`: React.ReactNode - custom icon
- `primaryAction`: { label: string; onClick: () => void } - main action
- `secondaryAction`: Same structure as primary
- `className`: Additional CSS classes

**Example:**

```tsx
import { EmptyState } from '@/components/EmptyState';
import { PlusIcon } from 'lucide-react';

export function EmployeeListEmpty() {
  return (
    <EmptyState
      title="No employees yet"
      description="Start adding employees to manage your team"
      icon={<PlusIcon size={48} className="text-gray-400" />}
      primaryAction={{
        label: 'Add Employee',
        onClick: () => navigateTo('/add-employee'),
      }}
      secondaryAction={{
        label: 'Import CSV',
        onClick: () => navigateTo('/import'),
      }}
    />
  );
}
```

**Accessibility:**
- Semantic `role="status"` for screen readers
- Buttons are properly labeled and keyboard accessible

---

### 5. ErrorState

Displays an error state with retry and action options.

**Props:**
- `title`: string - error title
- `message`: string - error description
- `code`: string - error code
- `onRetry`: () => void - retry callback
- `action`: { label: string; onClick: () => void } - additional action
- `isRetrying`: boolean - show loading state
- `className`: Additional CSS classes

**Example:**

```tsx
import { ErrorState } from '@/components/ErrorState';

export function DataFetcher() {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await fetchData();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <ErrorState
      title="Failed to load employees"
      message="An error occurred while fetching employee data"
      code="ERR_FETCH_500"
      onRetry={handleRetry}
      isRetrying={isRetrying}
      action={{
        label: 'Contact Support',
        onClick: () => openSupportChat(),
      }}
    />
  );
}
```

**Accessibility:**
- Semantic `role="alert"` for error announcements
- Loading state properly indicated during retry
- All interactive elements are keyboard accessible

---

### 6. Timeline

A vertical/horizontal timeline component for visualizing process steps.

**Props:**
- `items`: Array of TimelineItem
  - `id`: string - unique identifier
  - `label`: string - step label
  - `description`: string - step description
  - `status`: 'completed' | 'current' | 'pending' | 'error'
  - `timestamp`: string - optional timestamp
- `direction`: 'vertical' | 'horizontal'
- `className`: Additional CSS classes

**Example:**

```tsx
import { Timeline } from '@/components/Timeline';

export function PaymentTimeline() {
  const steps = [
    {
      id: '1',
      label: 'Payment Initiated',
      status: 'completed',
      timestamp: '10:00 AM',
    },
    {
      id: '2',
      label: 'Processing',
      description: 'Validating transaction',
      status: 'current',
      timestamp: '10:05 AM',
    },
    {
      id: '3',
      label: 'Confirmation Pending',
      status: 'pending',
    },
  ];

  return <Timeline items={steps} direction="vertical" />;
}
```

**Accessibility:**
- Semantic list structure (`<ol>` or layout equivalent)
- Status indicator colors are not the only way to convey information
- Timestamps are properly marked with `<time>` element

---

### 7. Enhanced FormField

The FormField component now includes additional features for enhanced UX.

**New Props:**
- `optional`: boolean - show optional indicator
- `isValid`: boolean - show success indicator
- `maxLength`: number - max characters
- `currentLength`: number - current character count

**Example:**

```tsx
import { FormField } from '@/components/FormField';
import { useState } from 'react';

export function EmployeeForm() {
  const [bio, setBio] = useState('');
  const maxBioLength = 200;

  return (
    <form className="space-y-6">
      <FormField
        id="name"
        label="Full Name"
        required={true}
        error={nameError}
        isValid={isNameValid}
        helpText="Enter your full legal name"
      >
        <input type="text" value={name} onChange={handleNameChange} />
      </FormField>

      <FormField
        id="bio"
        label="Bio"
        optional={true}
        maxLength={maxBioLength}
        currentLength={bio.length}
      >
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={maxBioLength}
        />
      </FormField>

      <FormField
        id="salary"
        label="Annual Salary"
        required={true}
        error={salaryError}
      >
        <input type="number" />
      </FormField>
    </form>
  );
}
```

**New Features:**
- Character count with visual progress bar
- Success indicator for valid fields
- Optional label indicator
- Warning state when approaching max length
- Better validation feedback with icon

**Accessibility Improvements:**
- Enhanced error message display with icon
- Character count linked via `aria-describedby`
- Proper labeling for optional vs required fields

---

## Usage Patterns

### Pattern 1: Data List with Pagination

```tsx
import { PaginationControls } from '@/components/PaginationControls';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonLoader } from '@/components/SkeletonLoader';

export function EmployeeList() {
  const [page, setPage] = useState(1);
  const { data: employees, isLoading, error } = useEmployees(page);

  if (isLoading) {
    return <SkeletonLoader variant="table-row" count={5} />;
  }

  if (error) {
    return <ErrorState title="Error loading employees" />;
  }

  if (!employees.length) {
    return (
      <EmptyState
        title="No employees found"
        primaryAction={{ label: 'Add', onClick: () => {} }}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {employees.map((emp) => (
          <EmployeeCard key={emp.id} employee={emp} />
        ))}
      </div>
      <PaginationControls
        currentPage={page}
        totalPages={Math.ceil(employees.totalCount / 10)}
        onPageChange={setPage}
      />
    </>
  );
}
```

### Pattern 2: Form with Character Count

```tsx
export function BioEditor() {
  const [bio, setBio] = useState('');
  const maxLength = 500;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleValidation = () => {
    if (!bio.trim()) {
      setErrors({ bio: 'Bio cannot be empty' });
      return false;
    }
    setErrors({});
    return true;
  };

  return (
    <FormField
      id="bio"
      label="Employee Bio"
      required={true}
      error={errors.bio}
      isValid={bio.length > 20}
      maxLength={maxLength}
      currentLength={bio.length}
      helpText="Provide a brief professional biography"
    >
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded"
        maxLength={maxLength}
      />
    </FormField>
  );
}
```

### Pattern 3: Status Timeline

```tsx
export function PaymentTimeline({ payment }) {
  const timelineItems = [
    {
      id: 'init',
      label: 'Payment Initiated',
      status: payment.status === 'initiated' ? 'current' : 'completed',
      timestamp: formatTime(payment.createdAt),
    },
    {
      id: 'validation',
      label: 'Validating',
      status: ['validation', 'processing'].includes(payment.status)
        ? payment.status === 'validation'
          ? 'current'
          : 'completed'
        : 'pending',
    },
    // ... more items
  ];

  return <Timeline items={timelineItems} />;
}
```

---

## Design System Integration

### Colors

All components use CSS variables for theming:

- Primary Accent: `var(--accent)` (#4AF0B8)
- Background: `var(--bg)`
- Surface: `var(--surface)`
- Text: `var(--text)`
- Muted: `var(--muted)`
- Border: `var(--border-hi)`

### Spacing

- Base unit: 4px
- Components use consistent padding: 4, 6, 8 units
- Gap spacing: 3, 4, 5, 6 units

### Typography

- Font weights: 400, 600, 700, 800
- Responsive text sizes
- Consistent line heights

---

## Accessibility Checklist

- ✅ All components meet WCAG 2.1 AA standards
- ✅ Keyboard navigation fully supported
- ✅ Screen reader compatible
- ✅ Proper color contrast (minimum 4.5:1 for text)
- ✅ Focus indicators visible
- ✅ Semantic HTML structure
- ✅ ARIA labels and roles where needed
- ✅ Error messages properly associated with inputs

---

## Testing

All components include comprehensive unit tests covering:

- Rendering and props validation
- User interactions (click, keyboard)
- Accessibility attributes
- State changes
- Edge cases

Run tests with:
```bash
npm run test -- --watch
```

---

## Performance Considerations

- Components use React.memo where appropriate
- Debounced interactions (300ms)
- Lazy loading for complex modals
- Optimized re-renders
- CSS animations use GPU acceleration

---

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari, Chrome Mobile

---

## Future Enhancements

- [ ] Virtual scrolling for large lists
- [ ] Custom theming API
- [ ] Animation presets
- [ ] Component composition helpers
- [ ] Advanced validation patterns

---

**Last Updated**: 2026-05-31  
**Version**: 1.0.0  
**Status**: Production Ready
