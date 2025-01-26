import { Directive, HostListener } from '@angular/core';

@Directive({
    selector: '[disableDblClick]'
})
export class DisableDblClickDirective {
    @HostListener('dblclick', ['$event'])
    handleDblClick(event: MouseEvent) {
        // Prevent the default double-click action
        event.preventDefault();
        event.stopPropagation();
    }
}