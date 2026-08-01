import type { KeyboardEvent, ReactNode } from "react";
import { formControlClassName } from "@/components/form/form-field";

type ChipListRowProps = {
  label: string;
  error?: string;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  trailing?: ReactNode;
  editableLabel?: boolean;
  onLabelChange?: (value: string) => void;
};

export function ChipListRow({
  label,
  error,
  disableMoveUp = false,
  disableMoveDown = false,
  onMoveUp,
  onMoveDown,
  onRemove,
  trailing,
  editableLabel = false,
  onLabelChange,
}: ChipListRowProps) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-foreground/10 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="space-y-1">
          {editableLabel && onLabelChange ? (
            <input
              type="text"
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
              className={`${formControlClassName} max-w-xs`}
              aria-invalid={Boolean(error)}
            />
          ) : (
            <span className="inline-flex rounded-full bg-foreground/5 px-3 py-1 text-sm font-medium">
              {label}
            </span>
          )}
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
        {trailing}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Move ${label} up`}
          disabled={disableMoveUp}
          onClick={onMoveUp}
          className="rounded-lg border border-foreground/15 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Move ${label} down`}
          disabled={disableMoveDown}
          onClick={onMoveDown}
          className="rounded-lg border border-foreground/15 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↓
        </button>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="rounded-lg border border-foreground/15 px-2 py-1 text-sm"
        >
          ×
        </button>
      </div>
    </li>
  );
}

type OrderedNameListProps = {
  items: string[];
  newItemValue: string;
  onNewItemValueChange: (value: string) => void;
  onAddItem: () => void;
  onNewItemKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onMoveItem: (index: number, direction: -1 | 1) => void;
  onRemoveItem: (index: number) => void;
  fieldErrors: Record<string, string>;
  addFieldId: string;
  addFieldLabel: string;
  addFieldErrorKey: string;
  itemErrorKeyPrefix: string;
  listLabel: string;
  emptyMessage: string;
  addHelpText: string;
  renderAddField: (props: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
    error?: string;
    describedBy: string;
  }) => ReactNode;
};

export function OrderedNameList({
  items,
  newItemValue,
  onNewItemValueChange,
  onAddItem,
  onNewItemKeyDown,
  onMoveItem,
  onRemoveItem,
  fieldErrors,
  addFieldId,
  addFieldLabel,
  addFieldErrorKey,
  itemErrorKeyPrefix,
  listLabel,
  emptyMessage,
  addHelpText,
  renderAddField,
}: OrderedNameListProps) {
  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            {renderAddField({
              id: addFieldId,
              label: addFieldLabel,
              value: newItemValue,
              onChange: onNewItemValueChange,
              onKeyDown: onNewItemKeyDown,
              error: fieldErrors[addFieldErrorKey],
              describedBy: `${addFieldId}-help`,
            })}
          </div>
          <button
            type="button"
            onClick={onAddItem}
            className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Add
          </button>
        </div>
        <p id={`${addFieldId}-help`} className="text-xs text-foreground/60">
          {addHelpText}
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium">{listLabel}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-foreground/60">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <ChipListRow
                key={`${itemErrorKeyPrefix}-${index}-${item}`}
                label={item}
                error={fieldErrors[`${itemErrorKeyPrefix}-${index}`]}
                disableMoveUp={index === 0}
                disableMoveDown={index === items.length - 1}
                onMoveUp={() => onMoveItem(index, -1)}
                onMoveDown={() => onMoveItem(index, 1)}
                onRemove={() => onRemoveItem(index)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
