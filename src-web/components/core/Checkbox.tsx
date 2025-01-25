import classNames from 'classnames';
import { type ReactNode } from 'react';
import { trackEvent } from '../../lib/analytics';
import { Icon } from './Icon';
import { HStack } from './Stacks';

export interface CheckboxProps {
  checked: boolean | 'indeterminate';
  title: ReactNode;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  inputWrapperClassName?: string;
  hideLabel?: boolean;
  event?: string;
}

export function Checkbox({
  checked,
  onChange,
  className,
  inputWrapperClassName,
  disabled,
  title,
  hideLabel,
  event,
}: CheckboxProps) {
  return (
    <HStack as="label" space={2} className={classNames(className, 'text-text mr-auto')}>
      <div className={classNames(inputWrapperClassName, 'x-theme-input', 'relative flex')}>
        <input
          aria-hidden
          className={classNames(
            'appearance-none w-4 h-4 flex-shrink-0 border border-border',
            'rounded outline-none ring-0',
            !disabled && 'hocus:border-border-focus hocus:bg-focus/[5%] ',
            disabled && 'border-dotted',
          )}
          type="checkbox"
          disabled={disabled}
          onChange={() => {
            onChange(checked === 'indeterminate' ? true : !checked);
            if (event != null) {
              trackEvent('button', 'click', { id: event, checked: checked ? 'on' : 'off' });
            }
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon
            size="sm"
            icon={checked === 'indeterminate' ? 'minus' : checked ? 'check' : 'empty'}
          />
        </div>
      </div>
      <span className={classNames(disabled && 'opacity-disabled')}>{!hideLabel && title}</span>
    </HStack>
  );
}
