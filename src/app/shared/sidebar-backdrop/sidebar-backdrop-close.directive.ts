import { Directive, HostListener, OnInit } from '@angular/core';
import { Sidebar } from 'primeng/sidebar';

/**
 * Closes a modal `p-sidebar` only when its backdrop itself is clicked.
 *
 * PrimeNG 18's Sidebar renders the panel inside its backdrop and closes on any click that reaches the
 * backdrop, including clicks bubbling up from buttons inside the panel ("Load more" closed the
 * notifications panel). PrimeNG 17 put the backdrop beside the panel, so only a click outside closed it.
 * This turns the built-in dismissal off and restores that behaviour.
 */
@Directive({
  selector: 'p-sidebar[imsBackdropClose]',
  standalone: true,
})
export class SidebarBackdropCloseDirective implements OnInit {
  constructor(private readonly sidebar: Sidebar) {}

  ngOnInit(): void {
    this.sidebar.dismissible = false;
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.classList.contains('p-drawer-mask')) {
      this.sidebar.close(event);
    }
  }
}
