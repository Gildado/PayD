import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, User, Mail, Phone, Briefcase, CreditCard } from 'lucide-react';
import { FormField } from './FormField';

export interface EmployeeProfileData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  jobTitle?: string;
  department?: string;
  hireDate?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  withdrawalPreference?: 'bank' | 'mobile_money' | 'crypto';
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  mobileMoneyProvider?: string;
  mobileMoneyAccount?: string;
  notes?: string;
  walletAddress?: string;
  salary?: number;
}

interface EmployeeProfileModalProps {
  isOpen: boolean;
  employee?: EmployeeProfileData;
  onClose: () => void;
  onSave: (data: EmployeeProfileData) => void;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  isOpen,
  employee,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<EmployeeProfileData>(
    employee || {
      firstName: '',
      lastName: '',
      email: '',
      withdrawalPreference: 'crypto',
    }
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-hi bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hi bg-[var(--surface)] px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              {employee?.id ? t('employeeProfile.updateProfile') : t('employeeProfile.title')}
            </p>
            <h2 className="mt-1 text-2xl font-black text-[var(--text)]">
              {employee?.id
                ? `${employee.firstName} ${employee.lastName}`
                : t('employeeProfile.subtitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--text)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-8">
            {/* Personal Information */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text)]">
                  {t('employeeProfile.personalInfo')}
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="firstName" label={t('employeeProfile.firstName')} required>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="lastName" label={t('employeeProfile.lastName')} required>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="dateOfBirth" label={t('employeeProfile.dateOfBirth')}>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
              </div>
            </section>

            {/* Contact Information */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text)]">
                  {t('employeeProfile.contactInfo')}
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="email" label={t('employeeProfile.email')} required>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="phone" label={t('employeeProfile.phone')}>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField id="address" label={t('employeeProfile.address')}>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address || ''}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                    />
                  </FormField>
                </div>
                <FormField id="city" label={t('employeeProfile.city')}>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="state" label={t('employeeProfile.state')}>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="postalCode" label={t('employeeProfile.postalCode')}>
                  <input
                    type="text"
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="country" label={t('employeeProfile.country')}>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
              </div>
            </section>

            {/* Employment Details */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text)]">
                  {t('employeeProfile.employmentDetails')}
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="jobTitle" label={t('employeeProfile.jobTitle')}>
                  <input
                    type="text"
                    id="jobTitle"
                    name="jobTitle"
                    value={formData.jobTitle || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="department" label={t('employeeProfile.department')}>
                  <input
                    type="text"
                    id="department"
                    name="department"
                    value={formData.department || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField id="hireDate" label={t('employeeProfile.hireDate')}>
                  <input
                    type="date"
                    id="hireDate"
                    name="hireDate"
                    value={formData.hireDate || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
              </div>
            </section>

            {/* Emergency Contact */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text)]">
                  {t('employeeProfile.emergencyContact')}
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="emergencyContactName"
                  label={t('employeeProfile.emergencyContactName')}
                >
                  <input
                    type="text"
                    id="emergencyContactName"
                    name="emergencyContactName"
                    value={formData.emergencyContactName || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
                <FormField
                  id="emergencyContactPhone"
                  label={t('employeeProfile.emergencyContactPhone')}
                >
                  <input
                    type="tel"
                    id="emergencyContactPhone"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone || ''}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  />
                </FormField>
              </div>
            </section>

            {/* Payment Preferences */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text)]">
                  {t('employeeProfile.paymentPreferences')}
                </h3>
              </div>
              <div className="grid gap-4">
                <FormField
                  id="withdrawalPreference"
                  label={t('employeeProfile.withdrawalPreference')}
                >
                  <select
                    id="withdrawalPreference"
                    name="withdrawalPreference"
                    value={formData.withdrawalPreference || 'crypto'}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                  >
                    <option value="crypto">Crypto (Stellar)</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                </FormField>

                {formData.withdrawalPreference === 'bank' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField id="bankName" label={t('employeeProfile.bankName')}>
                      <input
                        type="text"
                        id="bankName"
                        name="bankName"
                        value={formData.bankName || ''}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                      />
                    </FormField>
                    <FormField id="bankAccountNumber" label={t('employeeProfile.accountNumber')}>
                      <input
                        type="text"
                        id="bankAccountNumber"
                        name="bankAccountNumber"
                        value={formData.bankAccountNumber || ''}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                      />
                    </FormField>
                    <FormField id="bankRoutingNumber" label={t('employeeProfile.routingNumber')}>
                      <input
                        type="text"
                        id="bankRoutingNumber"
                        name="bankRoutingNumber"
                        value={formData.bankRoutingNumber || ''}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                      />
                    </FormField>
                  </div>
                )}

                {formData.withdrawalPreference === 'mobile_money' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="mobileMoneyProvider"
                      label={t('employeeProfile.mobileMoneyProvider')}
                    >
                      <input
                        type="text"
                        id="mobileMoneyProvider"
                        name="mobileMoneyProvider"
                        value={formData.mobileMoneyProvider || ''}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                      />
                    </FormField>
                    <FormField
                      id="mobileMoneyAccount"
                      label={t('employeeProfile.mobileMoneyAccount')}
                    >
                      <input
                        type="text"
                        id="mobileMoneyAccount"
                        name="mobileMoneyAccount"
                        value={formData.mobileMoneyAccount || ''}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </section>

            {/* Additional Notes */}
            <section>
              <FormField id="notes" label={t('employeeProfile.notes')}>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
                />
              </FormField>
            </section>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-hi pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-hi px-6 py-3 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--bg)] transition hover:brightness-110"
            >
              {employee?.id ? t('employeeProfile.updateProfile') : t('employeeProfile.saveProfile')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
