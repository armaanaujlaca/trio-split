import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {description && (
        <div className="text-sm text-slate-600 dark:text-slate-300 mb-5">{description}</div>
      )}
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
