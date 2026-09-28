/**
 * Employee Removal Modal Translations
 *
 * Translation keys and values for the EmployeeRemovalConfirmModal component.
 * Support for English, Spanish, and French.
 *
 * @usage
 * ```typescript
 * // Import translations and merge into your locale files:
 * import { EN_TRANSLATIONS, ES_TRANSLATIONS, FR_TRANSLATIONS } from '@/types/employeeRemovalTranslations';
 *
 * // In your i18n config:
 * locales/en/translation.json: { ...EN_TRANSLATIONS, ...otherTranslations }
 * locales/es/translation.json: { ...ES_TRANSLATIONS, ...otherTranslations }
 * locales/fr/translation.json: { ...FR_TRANSLATIONS, ...otherTranslations }
 * ```
 */

export interface EmployeeRemovalTranslations {
  employeeRemoval: {
    title: string;
    subtitle: string;
    employeeToRemove: string;
    warning: string;
    warningTitle: string;
    confirmation: string;
    confirmRemove: string;
  };
  common: {
    remove: string;
    cancel: string;
    close: string;
  };
}

/**
 * English (en) Translations
 */
export const EN_TRANSLATIONS = {
  employeeRemoval: {
    title: 'Remove Employee',
    subtitle: 'Are you sure you want to remove this employee?',
    employeeToRemove: 'Employee to be removed:',
    warning:
      'This action cannot be undone. All employee records and associated data will be deleted.',
    warningTitle: 'Permanent Action',
    confirmation: 'Confirm by clicking Remove below.',
    confirmRemove: 'Confirm removal of {name}',
  },
  common: {
    remove: 'Remove',
    cancel: 'Cancel',
    close: 'Close',
  },
};

/**
 * Spanish (es) Translations
 */
export const ES_TRANSLATIONS = {
  employeeRemoval: {
    title: 'Eliminar Empleado',
    subtitle: '¿Está seguro de que desea eliminar este empleado?',
    employeeToRemove: 'Empleado a ser eliminado:',
    warning:
      'Esta acción no se puede deshacer. Todos los registros de empleados y datos asociados serán eliminados.',
    warningTitle: 'Acción Permanente',
    confirmation: 'Confirme haciendo clic en Eliminar a continuación.',
    confirmRemove: 'Confirmar eliminación de {name}',
  },
  common: {
    remove: 'Eliminar',
    cancel: 'Cancelar',
    close: 'Cerrar',
  },
};

/**
 * French (fr) Translations
 */
export const FR_TRANSLATIONS = {
  employeeRemoval: {
    title: 'Supprimer un Employé',
    subtitle: 'Êtes-vous sûr de vouloir supprimer cet employé ?',
    employeeToRemove: 'Employé à supprimer :',
    warning:
      "Cette action ne peut pas être annulée. Tous les enregistrements d'employés et les données associées seront supprimés.",
    warningTitle: 'Action Permanente',
    confirmation: 'Confirmez en cliquant sur Supprimer ci-dessous.',
    confirmRemove: 'Confirmer la suppression de {name}',
  },
  common: {
    remove: 'Supprimer',
    cancel: 'Annuler',
    close: 'Fermer',
  },
};

/**
 * Translation Keys (for type-safe access)
 * Use these as constants to access translations via `t()` function
 */
export const EMPLOYEE_REMOVAL_KEYS = {
  TITLE: 'employeeRemoval.title',
  SUBTITLE: 'employeeRemoval.subtitle',
  EMPLOYEE_TO_REMOVE: 'employeeRemoval.employeeToRemove',
  WARNING: 'employeeRemoval.warning',
  WARNING_TITLE: 'employeeRemoval.warningTitle',
  CONFIRMATION: 'employeeRemoval.confirmation',
  CONFIRM_REMOVE: 'employeeRemoval.confirmRemove',
} as const;

export const COMMON_KEYS = {
  REMOVE: 'common.remove',
  CANCEL: 'common.cancel',
  CLOSE: 'common.close',
} as const;
