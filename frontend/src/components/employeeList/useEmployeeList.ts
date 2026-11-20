import { useMemo, useState } from 'react';
import type { DropResult } from '@hello-pangea/dnd';
import { useDebounce } from '../../hooks/useDebounce';
import { useNotification } from '../../hooks/useNotification';
import type { CSVRow } from '../CSVUploader';
import type { Employee, EmployeeListProps, StatusFilter } from './types';
import { copyWithFallback, shortenWallet } from './utils';

/**
 * State and derived data for EmployeeList. Kept independent from the JSX so
 * the presentation components remain pure and the filtering/sorting work is
 * still memoised (no extra renders compared with the original monolith).
 */
export function useEmployeeList({
  employees,
  isLoading = false,
  onAddEmployee,
  onEditEmployee,
  onRemoveEmployee,
  onUpdateEmployeeImage,
}: EmployeeListProps) {
  const { notifySuccess } = useNotification();
  const [csvData, setCsvData] = useState<Employee[]>([]);
  const [showCSVUploader, setShowCSVUploader] = useState(false);
  const [showEditModal, setShowEditModal] = useState<{ open: boolean; employee?: Employee }>({
    open: false,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    open: boolean;
    employee?: Employee;
  }>({
    open: false,
  });
  const [showAvatarModal, setShowAvatarModal] = useState<{
    open: boolean;
    employee?: Employee;
  }>({ open: false });
  const [sortKey, setSortKey] = useState<keyof Employee>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [editSalary, setEditSalary] = useState<number>(0);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<Employee[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const activeEmployees = employees.filter((employee) => employee.status !== 'Inactive').length;
  const monthlyPayroll = employees.reduce((total, employee) => total + (employee.salary ?? 0), 0);

  const handleDataParsed = (data: CSVRow[]) => {
    const newEmployees = data
      .filter((row) => row.isValid)
      .map((row) => ({
        id: String(Date.now() + Math.random()),
        name: row.data.name,
        email: row.data.email,
        wallet: row.data.wallet,
        position: row.data.position,
        salary: Number(row.data.salary) || 0,
        status: (row.data.status as 'Active' | 'Inactive') || 'Active',
      }));

    setCsvData(newEmployees);
  };

  const handleAddEmployees = () => {
    csvData.forEach((employee) => {
      onAddEmployee(employee);
    });

    notifySuccess(
      `Imported ${csvData.length} employee${csvData.length === 1 ? '' : 's'}`,
      'The directory has been updated with the validated CSV records.'
    );
    setCsvData([]);
    setShowCSVUploader(false);
  };

  const handleSort = (key: keyof Employee) => {
    if (sortKey === key) {
      setSortAsc((current) => !current);
      return;
    }

    setSortKey(key);
    setSortAsc(true);
  };

  const filteredEmployees = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.position.toLowerCase().includes(query) ||
        employee.wallet?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'All' || employee.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [debouncedSearch, employees, statusFilter]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      const valueA = a[sortKey] ?? '';
      const valueB = b[sortKey] ?? '';

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortAsc ? valueA - valueB : valueB - valueA;
      }

      return sortAsc
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });
  }, [filteredEmployees, sortAsc, sortKey]);

  const displayedEmployees = reorderMode ? reorderList : sortedEmployees;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = [...reorderList];
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setReorderList(items);
  };

  const toggleReorderMode = () => {
    if (!reorderMode) setReorderList(sortedEmployees);
    setReorderMode((prev) => !prev);
  };

  const handleDeleteConfirm = (employeeId: string) => {
    if (onRemoveEmployee) {
      onRemoveEmployee(employeeId);
    }
    setShowDeleteConfirm({ open: false });
  };

  const handleEditModalSubmit = () => {
    if (showEditModal.employee && onEditEmployee) {
      onEditEmployee({
        ...showEditModal.employee,
        salary: editSalary,
      });
    }
    setShowEditModal({ open: false });
  };

  const handleCopyWallet = async (employee: Employee) => {
    if (!employee.wallet) return;

    await copyWithFallback(employee.wallet);
    notifySuccess(`${employee.name}'s wallet copied`, shortenWallet(employee.wallet));
    setCopiedId(employee.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Small presentation helpers for the modal/toolbar interactions. They keep
  // the extracted components declarative without adding state or renders.
  const toggleCSVUploader = () => setShowCSVUploader((current) => !current);
  const cancelCSVImport = () => {
    setShowCSVUploader(false);
    setCsvData([]);
  };
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
  };
  const openEditModal = (employee: Employee) => {
    setEditSalary(employee.salary || 0);
    setShowEditModal({ open: true, employee });
  };
  const closeEditModal = () => setShowEditModal({ open: false });
  const openDeleteConfirm = (employee: Employee) => setShowDeleteConfirm({ open: true, employee });
  const closeDeleteConfirm = () => setShowDeleteConfirm({ open: false });
  const openAvatarModal = (employee: Employee) => setShowAvatarModal({ open: true, employee });
  const closeAvatarModal = () => setShowAvatarModal({ open: false });
  const updateEditSalary = (value: number) => setEditSalary(value);
  const handleImageUpload = (imageUrl: string) => {
    const employee = showAvatarModal.employee;
    if (!employee) return;
    if (onUpdateEmployeeImage) {
      onUpdateEmployeeImage(employee.id, imageUrl);
    } else if (onEditEmployee) {
      onEditEmployee({ ...employee, imageUrl });
    }
    setShowAvatarModal({ open: false });
  };

  const showEmptyState = !isLoading && sortedEmployees.length === 0;

  return {
    // data
    activeEmployees,
    monthlyPayroll,
    displayedEmployees,
    debouncedSearch,
    showEmptyState,
    // view state
    csvData,
    showCSVUploader,
    showEditModal,
    showDeleteConfirm,
    showAvatarModal,
    sortKey,
    sortAsc,
    searchQuery,
    statusFilter,
    editSalary,
    reorderMode,
    copiedId,
    // handlers
    handleDataParsed,
    handleAddEmployees,
    handleSort,
    handleDragEnd,
    toggleReorderMode,
    handleDeleteConfirm,
    handleEditModalSubmit,
    handleCopyWallet,
    toggleCSVUploader,
    cancelCSVImport,
    clearFilters,
    openEditModal,
    closeEditModal,
    openDeleteConfirm,
    closeDeleteConfirm,
    openAvatarModal,
    closeAvatarModal,
    updateEditSalary,
    handleImageUpload,
    setSearchQuery,
    setStatusFilter,
  };
}
