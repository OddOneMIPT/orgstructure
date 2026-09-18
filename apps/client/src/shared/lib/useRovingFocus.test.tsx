import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useRovingFocus } from './useRovingFocus';

function List({
  ids,
  onActivate,
  onEscape,
  onKey,
  claimArrows = false,
}: {
  ids: string[];
  onActivate?: (id: string) => void;
  onEscape?: () => void;
  onKey?: (id: string, event: { key: string }) => boolean;
  claimArrows?: boolean;
}) {
  const containerRef = useRef<HTMLUListElement>(null);
  const roving = useRovingFocus({
    ids,
    containerRef,
    claimArrows,
    ...(onActivate ? { onActivate } : {}),
    ...(onEscape ? { onEscape } : {}),
    ...(onKey ? { onKey } : {}),
  });

  return (
    <ul ref={containerRef} onKeyDown={roving.onKeyDown}>
      {ids.map((id) => (
        <li key={id} {...roving.itemProps(id)}>
          {id}
        </li>
      ))}
    </ul>
  );
}

const ids = ['a', 'b', 'c', 'd'];

describe('useRovingFocus', () => {
  it('в порядке табуляции только первый элемент', () => {
    render(<List ids={ids} />);

    expect(screen.getByText('a')).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('b')).toHaveAttribute('tabindex', '-1');
  });

  it('стрелки двигают фокус', async () => {
    const user = userEvent.setup();
    render(<List ids={ids} />);

    screen.getByText('a').focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('b')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('c')).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByText('b')).toHaveFocus();
  });

  it('не уезжает за границы списка', async () => {
    const user = userEvent.setup();
    render(<List ids={ids} />);

    screen.getByText('a').focus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByText('a')).toHaveFocus();

    await user.keyboard('{End}{ArrowDown}');
    expect(screen.getByText('d')).toHaveFocus();
  });

  it('Home и End прыгают к краям', async () => {
    const user = userEvent.setup();
    render(<List ids={ids} />);

    screen.getByText('a').focus();
    await user.keyboard('{End}');
    expect(screen.getByText('d')).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByText('a')).toHaveFocus();
  });

  it('Enter активирует текущий элемент', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<List ids={ids} onActivate={onActivate} />);

    screen.getByText('a').focus();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onActivate).toHaveBeenCalledWith('b');
  });

  it('свои клавиши перехватывают обработку', async () => {
    const user = userEvent.setup();
    const onKey = vi.fn((_id: string, event: { key: string }) => event.key === 'ArrowRight');
    render(<List ids={ids} onKey={onKey} />);

    screen.getByText('a').focus();
    await user.keyboard('{ArrowRight}');

    expect(onKey).toHaveBeenCalledWith('a', expect.objectContaining({ key: 'ArrowRight' }));
  });

  it('активный элемент привязан к id: при смене порядка фокус остаётся на том же', async () => {
    const user = userEvent.setup();

    function Sortable() {
      const [order, setOrder] = useState(ids);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOrder([...order].reverse());
            }}
          >
            перевернуть
          </button>
          <List ids={order} />
        </>
      );
    }

    render(<Sortable />);
    screen.getByText('a').focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('b')).toHaveAttribute('tabindex', '0');

    await user.click(screen.getByRole('button', { name: 'перевернуть' }));

    expect(screen.getByText('b')).toHaveAttribute('tabindex', '0');
  });

  it('если активный элемент исчез, активным становится первый', () => {
    const { rerender } = render(<List ids={ids} />);

    rerender(<List ids={['x', 'y']} />);

    expect(screen.getByText('x')).toHaveAttribute('tabindex', '0');
  });

  it('Escape вызывает обработчик и снимает обводку фокуса', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<List ids={ids} onEscape={onEscape} />);

    screen.getByText('a').focus();
    expect(screen.getByText('a')).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalled();
    expect(screen.getByText('a')).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it('после Escape стрелка снова входит в список', async () => {
    const user = userEvent.setup();
    render(<List ids={ids} claimArrows />);

    screen.getByText('a').focus();
    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowDown}');

    expect(screen.getByText('a')).toHaveFocus();
  });
});
