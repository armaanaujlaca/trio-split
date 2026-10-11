import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useToast } from './Toast';
import type { PersonId } from '../../types';

interface Props {
  /** Called with the new (or existing-matching) person's id after they're added. */
  onAdded?: (personId: PersonId) => void;
  /** Label for the inline input placeholder — defaults to "Add person…". */
  placeholder?: string;
}

/**
 * A chip-shaped "+ add person" affordance that reveals an inline input when
 * clicked. Dropped into the Who-paid / Who-participated rows so a new name
 * can be added without leaving the expense form.
 */
export function AddPersonChip({ onAdded, placeholder = 'Add person…' }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const addPerson = useStore((s) => s.addPerson);
  const toast = useToast();

  const submit = () => {
    const person = addPerson(name);
    if (person) {
      onAdded?.(person.id);
      // If the name was already in the list, surface that quietly instead of
      // silently swallowing the click so the user doesn't think it was ignored.
      if (person.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
        toast.show(`Using existing "${person.name}"`, { variant: 'info' });
      }
    }
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="chip inline-flex items-center gap-1"
        aria-label="Add new person"
      >
        <Plus className="w-3.5 h-3.5" />
        Add
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        type="text"
        className="input !py-1 !px-2 text-xs w-28"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setName('');
            setOpen(false);
          }
        }}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="btn-ghost !px-2 !py-1"
        onClick={submit}
        aria-label="Save new person"
      >
        <Plus className="w-4 h-4" />
      </button>
    </span>
  );
}
