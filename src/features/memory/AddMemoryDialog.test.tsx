import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AddMemoryDialog } from './AddMemoryDialog';

describe('AddMemoryDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the dialog mounted when onAdd throws', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onAdd = vi.fn().mockRejectedValue(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AddMemoryDialog
        open
        onOpenChange={onOpenChange}
        onAdd={onAdd}
        sections={['General']}
      />
    );

    await user.type(screen.getByLabelText('Memory section'), 'General');
    await user.type(screen.getByPlaceholderText('Enter the memory to store...'), 'remember this');
    await user.click(screen.getByRole('button', { name: 'Store Memory' }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('remember this', 'General');
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});
