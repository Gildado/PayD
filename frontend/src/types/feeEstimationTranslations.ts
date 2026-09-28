/**
 * i18n Translation Keys for FeeEstimationConfirmModal
 *
 * To integrate these translations, add them to your locale JSON files:
 * - locales/en/translation.json
 * - locales/es/translation.json
 * - locales/fr/translation.json
 * etc.
 *
 * Example structure:
 * {
 *   "feeEstimation": { ... },
 *   "common": { ... }
 * }
 */

export const FEE_ESTIMATION_CONFIRM_MODAL_KEYS = {
  // Main translations
  'feeEstimation.confirmModal.title': 'Network Fee Estimation',
  'feeEstimation.confirmModal.subtitle': 'Review estimated fees before confirming your bulk payout',

  // Payment Summary
  'feeEstimation.confirmModal.paymentSummary': 'Payment Summary',
  'feeEstimation.confirmModal.paymentCount': 'Total Payments',
  'feeEstimation.confirmModal.totalAmount': 'Total Amount',
  'feeEstimation.confirmModal.estimatedTxCount': 'Est. Transactions',
  'feeEstimation.confirmModal.estimatedTxCountHelp': 'Including on-chain processing',

  // Network Status
  'feeEstimation.confirmModal.networkStatus': 'Network Status',
  'feeEstimation.confirmModal.baseFee': 'Base Fee',
  'feeEstimation.confirmModal.recommendedFee': 'Recommended Fee',
  'feeEstimation.confirmModal.safetyMargin': 'Safety Margin',
  'feeEstimation.confirmModal.safetyMarginHelp': 'Applied due to network congestion',

  // Estimated Cost
  'feeEstimation.confirmModal.estimatedCost': 'Estimated Cost',
  'feeEstimation.confirmModal.estimateCostTooltip':
    'This is an estimate based on current network conditions. Actual fees may vary slightly.',
  'feeEstimation.confirmModal.totalFee': 'Total Fee',
  'feeEstimation.confirmModal.feePerTx': 'Fee per transaction',

  // Warnings
  'feeEstimation.confirmModal.highCongestion': 'High Network Congestion',
  'feeEstimation.confirmModal.highCongestionMessage':
    'Network congestion is high. Fees may increase. Consider retrying in a few minutes.',

  // Info
  'feeEstimation.confirmModal.processingTime':
    'Processing typically takes 5-30 seconds depending on network conditions.',

  // Buttons
  'feeEstimation.confirmModal.confirm': 'Confirm & Continue',

  // Congestion levels
  'feeEstimation.congestion.low': 'Low',
  'feeEstimation.congestion.moderate': 'Moderate',
  'feeEstimation.congestion.high': 'High',

  // Error handling
  'feeEstimation.error.title': 'Failed to estimate fees',
  'feeEstimation.error.message': 'Unable to fetch current network fees',

  // Common actions
  'common.retry': 'Retry',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
};

/**
 * English translations (en)
 * Paste this into your locales/en/translation.json
 */
export const EN_TRANSLATIONS = {
  feeEstimation: {
    confirmModal: {
      title: 'Network Fee Estimation',
      subtitle: 'Review estimated fees before confirming your bulk payout',
      paymentSummary: 'Payment Summary',
      paymentCount: 'Total Payments',
      totalAmount: 'Total Amount',
      estimatedTxCount: 'Est. Transactions',
      estimatedTxCountHelp: 'Including on-chain processing',
      networkStatus: 'Network Status',
      baseFee: 'Base Fee',
      recommendedFee: 'Recommended Fee',
      safetyMargin: 'Safety Margin',
      safetyMarginHelp: 'Applied due to network congestion',
      estimatedCost: 'Estimated Cost',
      estimateCostTooltip:
        'This is an estimate based on current network conditions. Actual fees may vary slightly.',
      totalFee: 'Total Fee',
      feePerTx: 'Fee per transaction',
      highCongestion: 'High Network Congestion',
      highCongestionMessage:
        'Network congestion is high. Fees may increase. Consider retrying in a few minutes.',
      processingTime: 'Processing typically takes 5-30 seconds depending on network conditions.',
      confirm: 'Confirm & Continue',
    },
    congestion: {
      low: 'Low',
      moderate: 'Moderate',
      high: 'High',
    },
    error: {
      title: 'Failed to estimate fees',
      message: 'Unable to fetch current network fees',
    },
  },
  common: {
    retry: 'Retry',
    close: 'Close',
    cancel: 'Cancel',
  },
};

/**
 * Spanish translations (es)
 * Paste this into your locales/es/translation.json
 */
export const ES_TRANSLATIONS = {
  feeEstimation: {
    confirmModal: {
      title: 'Estimación de Comisiones de Red',
      subtitle: 'Revisa las comisiones estimadas antes de confirmar tu pago masivo',
      paymentSummary: 'Resumen de Pagos',
      paymentCount: 'Pagos Totales',
      totalAmount: 'Monto Total',
      estimatedTxCount: 'Transacciones Est.',
      estimatedTxCountHelp: 'Incluyendo procesamiento en cadena',
      networkStatus: 'Estado de la Red',
      baseFee: 'Comisión Base',
      recommendedFee: 'Comisión Recomendada',
      safetyMargin: 'Margen de Seguridad',
      safetyMarginHelp: 'Aplicado debido a la congestión de la red',
      estimatedCost: 'Costo Estimado',
      estimateCostTooltip:
        'Esta es una estimación basada en las condiciones actuales de la red. Las comisiones reales pueden variar ligeramente.',
      totalFee: 'Comisión Total',
      feePerTx: 'Comisión por transacción',
      highCongestion: 'Congestión Alta de la Red',
      highCongestionMessage:
        'La congestión de la red es alta. Las comisiones pueden aumentar. Considera reintentar en unos minutos.',
      processingTime:
        'El procesamiento normalmente toma 5-30 segundos dependiendo de las condiciones de la red.',
      confirm: 'Confirmar y Continuar',
    },
    congestion: {
      low: 'Baja',
      moderate: 'Moderada',
      high: 'Alta',
    },
    error: {
      title: 'Falló la estimación de comisiones',
      message: 'No se pudieron obtener las comisiones de red actuales',
    },
  },
  common: {
    retry: 'Reintentar',
    close: 'Cerrar',
    cancel: 'Cancelar',
  },
};

/**
 * French translations (fr)
 * Paste this into your locales/fr/translation.json
 */
export const FR_TRANSLATIONS = {
  feeEstimation: {
    confirmModal: {
      title: 'Estimation des Frais Réseau',
      subtitle: 'Vérifiez les frais estimés avant de confirmer votre paiement en masse',
      paymentSummary: 'Résumé du Paiement',
      paymentCount: 'Total des Paiements',
      totalAmount: 'Montant Total',
      estimatedTxCount: 'Transactions Est.',
      estimatedTxCountHelp: 'Y compris le traitement en chaîne',
      networkStatus: 'État du Réseau',
      baseFee: 'Frais de Base',
      recommendedFee: 'Frais Recommandés',
      safetyMargin: 'Marge de Sécurité',
      safetyMarginHelp: 'Appliqué en raison de la congestion du réseau',
      estimatedCost: 'Coût Estimé',
      estimateCostTooltip:
        'Ceci est une estimation basée sur les conditions actuelles du réseau. Les frais réels peuvent varier légèrement.',
      totalFee: 'Frais Totaux',
      feePerTx: 'Frais par transaction',
      highCongestion: 'Congestion Élevée du Réseau',
      highCongestionMessage:
        'La congestion du réseau est élevée. Les frais peuvent augmenter. Envisagez de réessayer dans quelques minutes.',
      processingTime:
        'Le traitement prend généralement 5-30 secondes selon les conditions du réseau.',
      confirm: 'Confirmer et Continuer',
    },
    congestion: {
      low: 'Faible',
      moderate: 'Modérée',
      high: 'Élevée',
    },
    error: {
      title: "Échec de l'estimation des frais",
      message: "Impossible d'obtenir les frais réseau actuels",
    },
  },
  common: {
    retry: 'Réessayer',
    close: 'Fermer',
    cancel: 'Annuler',
  },
};

/**
 * Integration instructions:
 *
 * 1. Open your locale translation files:
 *    - src/locales/en/translation.json
 *    - src/locales/es/translation.json
 *    - src/locales/fr/translation.json
 *    etc.
 *
 * 2. Merge these translations into the respective files:
 *    {
 *      ...existing translations,
 *      ...EN_TRANSLATIONS (for en)
 *      ...ES_TRANSLATIONS (for es)
 *      ...FR_TRANSLATIONS (for fr)
 *    }
 *
 * 3. The FeeEstimationConfirmModal component will automatically
 *    use these translations via useTranslation() hook.
 *
 * 4. To add more languages, follow the same pattern with
 *    appropriate translations.
 */
