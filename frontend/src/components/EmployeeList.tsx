import React from 'react';
import { EmployeeRemovalConfirmModal } from './EmployeeRemovalConfirmModal';
import { AvatarModal } from './employeeList/AvatarModal';
import { CSVImportPanel } from './employeeList/CSVImportPanel';
import { EmployeeCardList } from './employeeList/EmployeeCardList';
import { EmployeeListHeader } from './employeeList/EmployeeListHeader';
import { EmployeeTable } from './employeeList/EmployeeTable';
import { EmptyState } from './employeeList/EmptyState';
import { SalaryEditModal } from './employeeList/SalaryEditModal';
import { useEmployeeList } from './employeeList/useEmployeeList';
import type { Employee, EmployeeListProps } from './employeeList/types';

export type { Employee } from './employeeList/types';

/**
 * Employee directory. All state lives in `useEmployeeList`; the JSX below only
 * composes focused presentation components, preserving the original markup.
 */
export const EmployeeList: React.FC<EmployeeListProps> = (props) => {
  const { isLoading = false, onEmployeeClick, onEditEmployee, onRemoveEmployee } = props;
  const state = useEmployeeList(props);

  return (
    <div className="w-full overflow-hidden rounded-[28px] border border-hi bg-[var(--surface)]/95 shadow-[var(--shadow-card)]">
      <EmployeeListHeader
        totalEmployees={props.employees.length}
        activeEmployees={state.activeEmployees}
        monthlyPayroll={state.monthlyPayroll}
        searchQuery={state.searchQuery}
        statusFilter={state.statusFilter}
        showCSVUploader={state.showCSVUploader}
        reorderMode={state.reorderMode}
        setSearchQuery={state.setSearchQuery}
        setStatusFilter={state.setStatusFilter}
        clearFilters={state.clearFilters}
        toggleCSVUploader={state.toggleCSVUploader}
        toggleReorderMode={state.toggleReorderMode}
      />

      {state.showCSVUploader ? (
        <CSVImportPanel
          csvData={state.csvData}
          onDataParsed={state.handleDataParsed}
          onAddEmployees={state.handleAddEmployees}
          onCancel={state.cancelCSVImport}
        />
      ) : null}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {!isLoading &&
          (state.debouncedSearch || state.statusFilter !== 'All'
            ? `${state.displayedEmployees.length} employee${state.displayedEmployees.length === 1 ? '' : 's'} found`
            : '')}
      </div>

      {state.showEmptyState ? (
        <div className="px-4 py-4 sm:px-6">
          <EmptyState searchQuery={state.debouncedSearch} />
        </div>
      ) : null}

      <EmployeeCardList
        displayedEmployees={state.displayedEmployees}
        isLoading={isLoading}
        reorderMode={state.reorderMode}
        showEmptyState={state.showEmptyState}
        copiedId={state.copiedId}
        canEdit={Boolean(onEditEmployee)}
        canDelete={Boolean(onRemoveEmployee)}
        onEmployeeClick={onEmployeeClick}
        onDragEnd={state.handleDragEnd}
        onAvatarClick={state.openAvatarModal}
        onCopyWallet={(employee: Employee) => void state.handleCopyWallet(employee)}
        onEdit={state.openEditModal}
        onDelete={state.openDeleteConfirm}
      />

      <EmployeeTable
        displayedEmployees={state.displayedEmployees}
        isLoading={isLoading}
        reorderMode={state.reorderMode}
        showEmptyState={state.showEmptyState}
        sortKey={state.sortKey}
        sortAsc={state.sortAsc}
        copiedId={state.copiedId}
        canEdit={Boolean(onEditEmployee)}
        canDelete={Boolean(onRemoveEmployee)}
        onEmployeeClick={onEmployeeClick}
        onDragEnd={state.handleDragEnd}
        onSort={state.handleSort}
        onAvatarClick={state.openAvatarModal}
        onCopyWallet={(employee: Employee) => void state.handleCopyWallet(employee)}
        onEdit={state.openEditModal}
        onDelete={state.openDeleteConfirm}
      />

      {state.showEditModal.open && state.showEditModal.employee ? (
        <SalaryEditModal
          employee={state.showEditModal.employee}
          editSalary={state.editSalary}
          onSalaryChange={state.updateEditSalary}
          onCancel={state.closeEditModal}
          onSubmit={state.handleEditModalSubmit}
        />
      ) : null}

      <EmployeeRemovalConfirmModal
        isOpen={state.showDeleteConfirm.open}
        employeeName={state.showDeleteConfirm.employee?.name || ''}
        employeeId={state.showDeleteConfirm.employee?.id || ''}
        onConfirm={state.handleDeleteConfirm}
        onCancel={state.closeDeleteConfirm}
      />

      {state.showAvatarModal.open && state.showAvatarModal.employee ? (
        <AvatarModal
          employee={state.showAvatarModal.employee}
          onClose={state.closeAvatarModal}
          onImageUpload={state.handleImageUpload}
        />
      ) : null}
    </div>
  );
};
