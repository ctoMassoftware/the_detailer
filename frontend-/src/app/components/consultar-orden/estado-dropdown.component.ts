import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface StatusOption {
  value: string;
  label: string;
  color: string;
  bgColor: string;
}

@Component({
  selector: 'app-estado-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dropdown-wrapper" [class.open]="isOpen">
      <!-- Selected Value Display -->
      <button
        class="dropdown-trigger"
        [class.disabled]="isDisabled"
        [attr.disabled]="isDisabled"
        (click)="toggleDropdown()">
        <span class="status-indicator" [style.background-color]="getColorForStatus(value)"></span>
        <span class="status-text">{{ getStatusLabel(value) }}</span>
        <span class="chevron-icon" [class.rotated]="isOpen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="2 5 8 11 14 5"></polyline>
          </svg>
        </span>
      </button>

      <!-- Dropdown Panel -->
      <div class="dropdown-panel" *ngIf="isOpen">
        <div class="dropdown-list">
          <button
            *ngFor="let option of options"
            class="dropdown-option"
            [class.selected]="option.value === value"
            (click)="selectOption(option.value)">
            <span class="option-indicator" [style.background-color]="option.color"></span>
            <span class="option-label">{{ option.label }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dropdown-wrapper {
      position: relative;
      display: inline-block;
      width: 100%;
      max-width: 200px;
    }

    /* ═══════════════════════════════════════════════════ */
    /* TRIGGER BUTTON (Selected Value) */
    /* ═══════════════════════════════════════════════════ */
    .dropdown-trigger {
      width: 100%;
      height: 48px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 12px;

      font-family: 'Inter', 'Segoe UI', 'Roboto', sans-serif;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #ffffff;

      background-color: #64748b;
      border: 2px solid #475569;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .dropdown-trigger:hover:not(.disabled) {
      background-color: #475569;
      border-color: #334155;
      box-shadow: 0 6px 16px rgba(71, 85, 105, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .dropdown-trigger:focus {
      outline: none;
      box-shadow: 0 0 0 4px rgba(100, 116, 139, 0.2), 0 4px 12px rgba(71, 85, 105, 0.3), 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .dropdown-trigger.disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    /* ═══════════════════════════════════════════════════ */
    /* STATUS INDICATOR (Colored Dot) */
    /* ═══════════════════════════════════════════════════ */
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background-color: currentColor;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    /* ═══════════════════════════════════════════════════ */
    /* STATUS TEXT */
    /* ═══════════════════════════════════════════════════ */
    .status-text {
      flex: 1;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ═══════════════════════════════════════════════════ */
    /* CHEVRON ICON */
    /* ═══════════════════════════════════════════════════ */
    .chevron-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }

    .chevron-icon.rotated {
      transform: rotate(180deg);
    }

    .chevron-icon svg {
      display: block;
      color: currentColor;
    }

    /* ═══════════════════════════════════════════════════ */
    /* DROPDOWN PANEL */
    /* ═══════════════════════════════════════════════════ */
    .dropdown-panel {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      background-color: #1e1e2e;
      border: 1px solid #2d2d44;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      overflow: hidden;
      animation: slideDown 0.15s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ═══════════════════════════════════════════════════ */
    /* DROPDOWN LIST */
    /* ═══════════════════════════════════════════════════ */
    .dropdown-list {
      display: flex;
      flex-direction: column;
      padding: 6px 0;
      max-height: 280px;
      overflow-y: auto;
    }

    /* ═══════════════════════════════════════════════════ */
    /* DROPDOWN OPTION */
    /* ═══════════════════════════════════════════════════ */
    .dropdown-option {
      height: 44px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 12px;

      font-family: 'Inter', 'Segoe UI', 'Roboto', sans-serif;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #ffffff;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }

    .dropdown-option:hover {
      background-color: #2d2d44;
    }

    .dropdown-option.selected {
      background-color: #3d3d54;
      font-weight: 600;
    }

    .dropdown-option.selected::after {
      content: '✓';
      margin-left: auto;
      font-weight: bold;
      font-size: 14px;
    }

    /* ═══════════════════════════════════════════════════ */
    /* OPTION INDICATOR */
    /* ═══════════════════════════════════════════════════ */
    .option-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .option-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ═══════════════════════════════════════════════════ */
    /* SCROLLBAR STYLING */
    /* ═══════════════════════════════════════════════════ */
    .dropdown-list::-webkit-scrollbar {
      width: 6px;
    }

    .dropdown-list::-webkit-scrollbar-track {
      background: #1e1e2e;
    }

    .dropdown-list::-webkit-scrollbar-thumb {
      background: #475569;
      border-radius: 3px;
    }

    .dropdown-list::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstadoDropdownComponent {
  @Input() value: string = 'Proceso';
  @Input() isDisabled: boolean = false;
  @Output() valueChange = new EventEmitter<string>();

  isOpen = false;

  options: StatusOption[] = [
    { value: 'Proceso', label: 'En proceso', color: '#F59E0B', bgColor: '#64748b' },
    { value: 'Lista', label: 'Orden lista', color: '#3B82F6', bgColor: '#3b82f6' },
    { value: 'Orden finalizada', label: 'Orden finalizada', color: '#10B981', bgColor: '#10b981' },
    { value: 'Cancelada', label: 'Cancelada', color: '#EF4444', bgColor: '#ef4444' }
  ];

  toggleDropdown(): void {
    if (!this.isDisabled) {
      this.isOpen = !this.isOpen;
    }
  }

  selectOption(value: string): void {
    this.value = value;
    this.valueChange.emit(value);
    this.isOpen = false;
  }

  getStatusLabel(value: string): string {
    return this.options.find(opt => opt.value === value)?.label || value;
  }

  getColorForStatus(value: string): string {
    return this.options.find(opt => opt.value === value)?.color || '#64748b';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-wrapper')) {
      this.isOpen = false;
    }
  }
}
