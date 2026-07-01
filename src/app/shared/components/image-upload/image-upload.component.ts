import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { resolvePublicAssetUrl } from 'src/app/shared/product-image.utils';

/**
 * Reusable single-image upload control that shares the product form's media style
 * (hero card + drag/drop dropzone + zoom/change/remove toolbar) so image upload
 * looks identical everywhere in the system.
 *
 * Presentational only: it validates the picked file (type + size) and emits it;
 * the parent performs the actual upload and passes the stored URL back via
 * {@link imageUrl}. Set {@link uploading} while the parent's request is in flight.
 */
@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    ImageModule,
    FileUploadModule,
    ProgressSpinnerModule,
    TooltipModule,
    RippleModule,
  ],
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.scss'],
})
export class ImageUploadComponent {
  /** Stored image URL (relative `/api/...` or absolute). Empty/undefined shows the dropzone. */
  @Input() imageUrl: string | null | undefined;
  /** Translation key for the heading (e.g. 'category_image', 'product_image'). */
  @Input() label = 'image';
  /** Render the card's own icon + title header. Disable when the host already shows a section title. */
  @Input() showHeader = true;
  /** Show the loading overlay while the parent uploads. */
  @Input() uploading = false;
  /** Max file size in bytes (default 5 MB, matching the product upload). */
  @Input() maxFileSize = 5 * 1024 * 1024;

  /** A valid image file was chosen (browse or drag-drop). */
  @Output() fileSelected = new EventEmitter<File>();
  /** The picked file was rejected; payload is a translation key for the reason. */
  @Output() validationError = new EventEmitter<string>();
  /** The user removed the current image. */
  @Output() cleared = new EventEmitter<void>();

  isDragOver = false;

  get resolvedUrl(): string {
    return this.imageUrl ? resolvePublicAssetUrl(this.imageUrl) : '';
  }

  /** PrimeNG p-fileUpload (basic, auto) select handler. */
  onFileUpload(event: any): void {
    const file: File | undefined = event?.files?.[0] ?? event?.currentFiles?.[0];
    this.handleFile(file);
  }

  /** Native <input type=file> change handler (used by the "change" toolbar action). */
  onNativeFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : undefined;
    this.handleFile(file);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    this.handleFile(event.dataTransfer?.files?.[0]);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  remove(): void {
    this.cleared.emit();
  }

  private handleFile(file: File | undefined | null): void {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.validationError.emit('only_images_allowed');
      return;
    }
    if (file.size > this.maxFileSize) {
      this.validationError.emit('image_too_large');
      return;
    }
    this.fileSelected.emit(file);
  }
}
