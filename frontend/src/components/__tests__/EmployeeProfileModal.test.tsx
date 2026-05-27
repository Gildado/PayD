import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmployeeProfileModal, type EmployeeProfileData } from '../EmployeeProfileModal';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('EmployeeProfileModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
  };

  const mockEmployee: EmployeeProfileData = {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    withdrawalPreference: 'crypto',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when isOpen is true', () => {
    render(<EmployeeProfileModal {...defaultProps} />);
    expect(screen.getByText('employeeProfile.title')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<EmployeeProfileModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('employeeProfile.title')).not.toBeInTheDocument();
  });

  it('displays employee data when provided', () => {
    render(<EmployeeProfileModal {...defaultProps} employee={mockEmployee} />);

    const firstNameInput = screen.getByDisplayValue('John');
    const lastNameInput = screen.getByDisplayValue('Doe');
    const emailInput = screen.getByDisplayValue('john.doe@example.com');

    expect(firstNameInput).toBeInTheDocument();
    expect(lastNameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<EmployeeProfileModal {...defaultProps} />);

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with form data when submitted', async () => {
    render(<EmployeeProfileModal {...defaultProps} />);

    const firstNameInput = screen.getByLabelText(/employeeProfile.firstName/i);
    const lastNameInput = screen.getByLabelText(/employeeProfile.lastName/i);
    const emailInput = screen.getByLabelText(/employeeProfile.email/i);

    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
    fireEvent.change(lastNameInput, { target: { value: 'Smith' } });
    fireEvent.change(emailInput, { target: { value: 'jane.smith@example.com' } });

    const submitButton = screen.getByText('employeeProfile.saveProfile');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
        })
      );
    });
  });

  it('shows bank fields when withdrawal preference is bank', () => {
    render(<EmployeeProfileModal {...defaultProps} />);

    const withdrawalSelect = screen.getByLabelText(/employeeProfile.withdrawalPreference/i);
    fireEvent.change(withdrawalSelect, { target: { value: 'bank' } });

    expect(screen.getByLabelText(/employeeProfile.bankName/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/employeeProfile.accountNumber/i)).toBeInTheDocument();
  });

  it('shows mobile money fields when withdrawal preference is mobile_money', () => {
    render(<EmployeeProfileModal {...defaultProps} />);

    const withdrawalSelect = screen.getByLabelText(/employeeProfile.withdrawalPreference/i);
    fireEvent.change(withdrawalSelect, { target: { value: 'mobile_money' } });

    expect(screen.getByLabelText(/employeeProfile.mobileMoneyProvider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/employeeProfile.mobileMoneyAccount/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<EmployeeProfileModal {...defaultProps} />);

    const submitButton = screen.getByText('employeeProfile.saveProfile');
    fireEvent.click(submitButton);

    // Form should not submit without required fields
    await waitFor(() => {
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it('handles all form field changes', () => {
    render(<EmployeeProfileModal {...defaultProps} employee={mockEmployee} />);

    const phoneInput = screen.getByLabelText(/employeeProfile.phone/i);
    fireEvent.change(phoneInput, { target: { value: '+9876543210' } });

    expect(phoneInput).toHaveValue('+9876543210');
  });
});
