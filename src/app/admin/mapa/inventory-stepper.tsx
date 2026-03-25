'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './mapa.module.css';
import { parseInventoryDraft } from './inventory-grid';

type InventoryStepperProps = {
    value: number | string;
    minValue?: number;
    maxValue: number;
    isLoading?: boolean;
    isZeroState?: boolean;
    className: string;
    editingDisabled?: boolean;
    decrementDisabled?: boolean;
    incrementDisabled?: boolean;
    decrementLabel: string;
    incrementLabel: string;
    displayValue?: string;
    onDecrement: () => void;
    onIncrement: () => void;
    onCommit: (value: number) => void;
    onInvalid: (message: string) => void;
};

export default function InventoryStepper({
    value,
    minValue = 0,
    maxValue,
    isLoading = false,
    className,
    editingDisabled = false,
    decrementDisabled = false,
    incrementDisabled = false,
    decrementLabel,
    incrementLabel,
    displayValue,
    onDecrement,
    onIncrement,
    onCommit,
    onInvalid,
}: InventoryStepperProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draftValue, setDraftValue] = useState(String(value));
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!isEditing || !inputRef.current) return;
        inputRef.current.focus();
        inputRef.current.select();
    }, [isEditing]);

    const cancelEdit = () => {
        setDraftValue(String(value));
        setIsEditing(false);
    };

    const commitEdit = () => {
        const parsed = parseInventoryDraft(draftValue, maxValue, minValue);
        if (!parsed.ok) {
            onInvalid(parsed.error);
            cancelEdit();
            return;
        }

        setIsEditing(false);
        if (parsed.value !== Number(value)) {
            onCommit(parsed.value);
        }
    };

    return (
        <div className={className}>
            <button
                type="button"
                className={styles.inventoryStepperButton}
                onClick={onDecrement}
                disabled={isLoading || decrementDisabled}
                aria-label={decrementLabel}
                data-no-drag="true"
            >
                -
            </button>
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="number"
                    min={minValue}
                    max={maxValue}
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            commitEdit();
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelEdit();
                        }
                    }}
                    className={styles.inventoryStepperInput}
                    aria-label="Editar quartos disponíveis"
                    data-no-drag="true"
                />
            ) : (
                <button
                    type="button"
                    className={styles.inventoryStepperValueButton}
                    onClick={() => {
                        if (isLoading || editingDisabled) return;
                        setDraftValue(String(value));
                        setIsEditing(true);
                    }}
                    disabled={isLoading || editingDisabled}
                    aria-label="Editar quartos disponíveis"
                    data-no-drag="true"
                >
                    <span className={styles.inventoryStepperValue}>
                        {isLoading ? '...' : (displayValue ?? value)}
                    </span>
                </button>
            )}
            <button
                type="button"
                className={styles.inventoryStepperButton}
                onClick={onIncrement}
                disabled={isLoading || incrementDisabled}
                aria-label={incrementLabel}
                data-no-drag="true"
            >
                +
            </button>
        </div>
    );
}
