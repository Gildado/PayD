# Integration Guide: Transaction Overlay & Enhanced Sidebar

## Quick Start

The features are already integrated into the `EmployerLayout` component. All employer routes automatically have access to the transaction notification system.

## Testing the Implementation

### Option 1: Use the Demo Component

Add the demo component to any employer route to test:

```typescript
// In any employer route file (e.g., Payroll.tsx)
import { TransactionOverlayDemo } from '../components/TransactionOverlayDemo';

export default function Payroll() {
  return (
    <div>
      {/* Your existing content */}

      {/* Add demo component for testing */}
      <TransactionOverlayDemo />
    </div>
  );
}
```

### Option 2: Add to a New Test Route

1. Create a test route in `App.tsx`:

```typescript
<Route
  path="/employer/demo"
  element={<TransactionOverlayDemo />}
/>
```

2. Navigate to `/employer/demo` to test

### Option 3: Integrate into Existing Components

Use in any component within the employer layout:

```typescript
import { useTransactionNotifications } from '../contexts/TransactionContext';

function YourComponent() {
  const { addTransaction, updateTransaction } = useTransactionNotifications();

  const handleAction = async () => {
    const txId = addTransaction({
      id: `action-${Date.now()}`,
      type: 'your-action-type',
      status: 'pending',
      description: 'Processing your action...',
    });

    try {
      const result = await yourAsyncAction();

      updateTransaction(txId, {
        status: 'confirmed',
        hash: result.transactionHash,
      });
    } catch (error) {
      updateTransaction(txId, {
        status: 'failed',
        description: error.message,
      });
    }
  };

  return <button onClick={handleAction}>Do Action</button>;
}
```

## Verifying the Sidebar Enhancements

1. Navigate to any employer route (e.g., `/employer/payroll`)
2. Observe the active state on the sidebar:
   - Left accent-colored border indicator
   - Subtle glow effect
   - Enhanced background color
3. Hover over inactive items:
   - Icons scale slightly
   - Subtle horizontal shift
   - Background overlay appears

## Integration with Existing Transaction System

### Payroll Component Integration

```typescript
// In frontend/src/pages/Payroll.tsx
import { useTransactionNotifications } from "../contexts/TransactionContext";

// Inside your component
const { addTransaction, updateTransaction } = useTransactionNotifications();

// When submitting payroll
const handlePayrollSubmit = async (payrollData) => {
  const txId = addTransaction({
    id: `payroll-${Date.now()}`,
    type: "payroll",
    status: "pending",
    description: `Processing payroll for ${payrollData.employeeCount} employees`,
  });

  try {
    const result = await submitPayroll(payrollData);

    updateTransaction(txId, {
      status: "confirmed",
      hash: result.transactionHash,
    });
  } catch (error) {
    updateTransaction(txId, {
      status: "failed",
      description: `Payroll failed: ${error.message}`,
    });
  }
};
```

### Bulk Upload Integration

```typescript
// In frontend/src/pages/BulkUpload.tsx
const handleBulkUpload = async (file) => {
  const txId = addTransaction({
    id: `bulk-${Date.now()}`,
    type: "bulk-upload",
    status: "pending",
    description: `Uploading ${file.name}...`,
  });

  try {
    const result = await uploadFile(file);

    updateTransaction(txId, {
      status: "confirmed",
      description: `Successfully uploaded ${result.recordCount} records`,
    });
  } catch (error) {
    updateTransaction(txId, {
      status: "failed",
      description: `Upload failed: ${error.message}`,
    });
  }
};
```

### Cross-Asset Payment Integration

```typescript
// In frontend/src/pages/CrossAssetPayment.tsx
const handleCrossAssetPayment = async (paymentData) => {
  const txId = addTransaction({
    id: `cross-asset-${Date.now()}`,
    type: "cross-asset",
    status: "pending",
    description: `Converting ${paymentData.fromAsset} to ${paymentData.toAsset}`,
  });

  try {
    const result = await processCrossAssetPayment(paymentData);

    updateTransaction(txId, {
      status: "confirmed",
      hash: result.transactionHash,
      description: `Converted ${paymentData.amount} ${paymentData.fromAsset}`,
    });
  } catch (error) {
    updateTransaction(txId, {
      status: "failed",
      description: `Conversion failed: ${error.message}`,
    });
  }
};
```

## WebSocket Integration

The system automatically listens for WebSocket events. Ensure your backend emits:

```javascript
// Backend example (Node.js)
socket.emit("transaction:update", {
  id: "transaction-id",
  status: "confirmed", // or 'failed'
  hash: "stellar-transaction-hash",
});
```

## Customization

### Changing Auto-Dismiss Delay

Edit `frontend/src/hooks/usePendingTransactions.ts`:

```typescript
const AUTO_DISMISS_DELAY = 5000; // Change to desired milliseconds
```

### Changing Maximum Notifications

Edit `frontend/src/hooks/usePendingTransactions.ts`:

```typescript
const MAX_NOTIFICATIONS = 5; // Change to desired number
```

### Customizing Notification Appearance

Edit `frontend/src/components/TransactionPendingOverlay.tsx` to modify:

- Position (currently bottom-right)
- Colors and styling
- Animation duration
- Icon choices

### Customizing Sidebar Active State

Edit `frontend/src/components/EmployerLayout.tsx`:

```typescript
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
    isActive
      ? "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)] shadow-[0_0_20px_rgba(74,240,184,0.15)] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1 before:rounded-r-full before:bg-[var(--accent)]"
      : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)] hover:translate-x-0.5"
  }`;
```

Adjust:

- `shadow-[0_0_20px_rgba(74,240,184,0.15)]` - Glow intensity
- `before:h-8` - Left border height
- `before:w-1` - Left border width
- `hover:translate-x-0.5` - Hover shift distance

## Troubleshooting

### Notifications Not Appearing

1. Verify you're within the `EmployerLayout` (routes under `/employer/*`)
2. Check browser console for errors
3. Ensure `TransactionProvider` is wrapping the component tree

### WebSocket Updates Not Working

1. Check WebSocket connection status
2. Verify backend is emitting `transaction:update` events
3. Check browser console for WebSocket errors

### Sidebar Active State Not Showing

1. Verify you're using `NavLink` from `react-router-dom`
2. Check that routes match exactly
3. Ensure CSS variables are defined in `index.css`

## Browser DevTools Testing

Open browser console and test manually:

```javascript
// Get the transaction context (if exposed)
// Or trigger via demo component buttons

// Check CSS variables
getComputedStyle(document.documentElement).getPropertyValue("--accent");
getComputedStyle(document.documentElement).getPropertyValue("--surface");
```

## Performance Monitoring

Monitor performance with React DevTools:

1. Check re-render frequency of `TransactionPendingOverlay`
2. Verify WebSocket event handlers are cleaned up
3. Monitor memory usage with multiple notifications

## Next Steps

1. Test with the demo component
2. Integrate into your existing transaction flows
3. Customize appearance to match your design
4. Add additional notification types as needed
5. Consider adding sound effects or desktop notifications

## Support

For issues or questions:

- Check `TRANSACTION_OVERLAY_IMPLEMENTATION.md` for detailed documentation
- Review example code in `frontend/src/examples/TransactionNotificationExample.tsx`
- Test with `frontend/src/components/TransactionOverlayDemo.tsx`
